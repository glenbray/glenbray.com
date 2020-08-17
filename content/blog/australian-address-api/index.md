---
title: Build your own Australian Address Search API
date: "2020-06-07"
description: "We'll explore creating an address search API using the GNAF dataset and elasticsearch"
---

[Code can be found here](https://github.com/glenbray/australian_address_api)

There are multiple services available that offer API's for address autocomplete
that also have generous free daily limits. But, there may be times when those
limits aren't enough and the costs of using the service may not be viable. An example
of a time when this was useful for me can be
[viewed here](https://glenbray.com/extracting-addresses-from-millions-of-pages-with-automl-and-ruby/).

Lets look at whats involved in creating our own Australian address search API using the
[GNAF dataset](https://psma.com.au/product/gnaf).

We'll be doing the following:

1. Run the gnaf-loader to import address data into a separate postgres DB.
2. Setup a new rails api project.
3. Use the new multi-database feature to connect to the GNAF DB in our app.
4. Sync to Elasticsearch.
5. Create 2 endpoints for address autocomplete and reverse geolocation lookup.

<hr />

## Import Australian Addresses with the gnaf-loader

Clone the gnaf-loader project.

    $ git clone git@github.com:minus34/gnaf-loader.git


The gnaf-loader has a [few options](https://github.com/minus34/gnaf-loader#process)
to import the data. Choose whichever option you prefer to load the data into
Postgres. This article will cover loading the data with docker.

1. From your terminal change directory to the repo you've just cloned `gnaf-loader`
2. Create a data directory in the root of the repo `mkdir data`.
3. Download the PSMA GNAF and ESRI shape file as mentioned from the readme of `gnaf-loader`.
4. Extract both and move directories into the `data` directory.
5. Before we build the address database let's update the dockerfile and open some ports.
  The change made can be [viewed here](link-to-file).
6. Run `docker-compose up` to build and run the containers.

Once the containers start running, this will start the import process. This will
take a while to run. While we wait, let's set up the API. Our API will use Elasticsearch
so we'll set that up first. With mac and homebrew this can be done with:

```bash
$ brew install Elasticsearch
$ brew services start Elasticsearch
```

<hr />

## Create a new rails project

    $ rails new australian_address_api --api --database=postgresql`


Configure your database.yml

```yaml
development:
  primary:
    <<: *default
    database: australian_address_api_development
  gnaf:
    <<: *default
    database: gnaf
```

This setup the DB.

    $ rails db:setup


We'll use the searchkick gem to search and index records in Elasticsearch. So
lets add that to the [gemfile](path/to/gemfile) and `bundle install`.

<hr />

## Prepare to sync to Elasticsearch

There are a few things we need to do before we start syncing records to
Elasticsearch. Firstly, we'll create an Address model and have it connect to our
GNAF DB. We'll use the new rails 6 multiple database feature to have this
model connect to our GNAF DB. This will enable us to separate the GNAF database
from our API DB. Here's the code to get that in place.

```ruby
class Address < ApplicationRecord
  connects_to database: {reading: :gnaf, writing: :gnaf}

  self.primary_key = "gid"
  self.table_name = "gnaf_202005.addresses"
end
```

Now that we can connect to the GNAF DB, lets setup searchkick.


```ruby
class Address < ApplicationRecord
  # ...

  STREET_SYNONYMS = [
    ['street','st'],
    ['terrace','tce'],
    ['road','rd'],
    ['boulevard','bvd'],
    ['close','cl'],
    ['crest','crst'],
    ['drive','dr'],
    ['avenue',' av'],
    ['highway',' hwy']
  ]

  searchkick default_fields: [:full_address],
      word_start: [:full_address],
      synonyms: STREET_SYNONYMS,
      locations: [:location]

  scope :search_import, -> { where("confidence > 0") }

  def should_index?
    confidence > 0
  end

  def full_address
    [address.titlecase, locality_name.titlecase, state, postcode].join(' ')
  end

  def search_data
    {
      full_address: full_address.downcase,
      suburb: locality_name.downcase,
      state: state.downcase,
      postcode: postcode,
      location: {
        lat: latitude.to_s,
        lon: longitude.to_s
      }
    }
  end
end
```

The `search_data` method is used to send the data for a record to Elasticsearch for what we'd
like to make searchable. We'll only be using the `full_address` and `location` fields in this
article.

The `search_import` and `should_index?` methods are used to only sync records matching the
specified condition. More information on what the
[confidence score means here](https://psma.com.au/product/gnaf/).

We also want to handle abbreviations for certain words within the address e.g street -> st. I've
created a synonyms constant for those mappings which are passed to searchkick.

<hr />

## Sync to elasticsearch

Now with that in place, let's start syncing records to Elasticsearch. You can do this with
`Address.reindex` from the rails console. This will sync around 11 - 14 million records and will
take a while to do. You can do this async to speed it up, but that is out of the scope of this
article. See the searchkick [readme](https://github.com/ankane/searchkick#parallel-reindexing)
for more info.

When syncing finishes, we can test search in the rails console:

```ruby
pry(main)> Address.search("38a wentworth rd vaucluse").first

Address Search (168.3ms)  addresses_development/_search {"query":{"bool":{"should":[{"dis_max":{"queries":[{"match":{"full_address.analyzed":{"query":"38a Wentworth Road Vaucluse NSW 2030","boost":10,"operator":"and","analyzer":"searchkick_search"}}},{"match":{"full_address.analyzed":{"query":"38a Wentworth Road Vaucluse NSW 2030","boost":10,"operator":"and","analyzer":"searchkick_search2"}}},{"match":{"full_address.analyzed":{"query":"38a Wentworth Road Vaucluse NSW 2030","boost":1,"operator":"and","analyzer":"searchkick_search","fuzziness":1,"prefix_length":0,"max_expansions":3,"fuzzy_transpositions":true}}},{"match":{"full_address.analyzed":{"query":"38a Wentworth Road Vaucluse NSW 2030","boost":1,"operator":"and","analyzer":"searchkick_search2","fuzziness":1,"prefix_length":0,"max_expansions":3,"fuzzy_transpositions":true}}}]}}]}},"timeout":"11s","_source":false,"size":10000}
Address Load (1.8ms)  SELECT "gnaf_202005"."addresses".* FROM "gnaf_202005"."addresses" WHERE "gnaf_202005"."addresses"."gid" = $1  [["gid", 12706313]]

=> #<Address:0x00007f827a068250
 gid: 12706313,
 gnaf_pid: "GANSW710434263",
 street_locality_pid: "NSW2925230",
 locality_pid: "NSW4107",
 alias_principal: "P",
 primary_secondary: nil,
 building_name: nil,
 lot_number: nil,
 flat_number: nil,
 level_number: nil,
 number_first: "38A",
 number_last: nil,
 street_name: "WENTWORTH",
 street_type: "ROAD",
 street_suffix: nil,
 address: "38A WENTWORTH ROAD",
 locality_name: "VAUCLUSE",
 postcode: "2030",
 state: "NSW",
 locality_postcode: "2030",
 confidence: 2,
 legal_parcel_id: "381//DP1061794",
 mb_2011_code: 10892260000,
 mb_2016_code: 10892260000,
 latitude: -0.3385606636e2,
 longitude: 0.15126996495e3,
 geocode_type: "PROPERTY CENTROID",
 reliability: 2,
 geom: "0101000020BB1000001FEA888DA3E86240F0B31D9593ED40C0">
```

<hr />

## Address autocomplete

While we wait for the sync to finish let's implement autocomplete address endpoint.

```ruby
# app/controllers/address_autocomplete_controller.rb
Rails.application.routes.draw do
  get "/address/autocomplete", controller: :address_autocomplete, action: :index
end
```

```ruby
# app/controllers/address_autocomplete_controller.rb
class AddressAutocompleteController < ActionController::API
  def index
    @addresses = Address.search(params[:q], match: :word_start)
  end
end
```

With the jbuilder gem, we can create a few templates that will generate our JSON. When setting
up a rails project this gem is included in the gemfile but commented out. Uncomment it and
run `bundle install`.

```ruby
# app/views/addresses/_address.jbuilder
json.address address["address"]
json.lot_number address["lot_number"]
json.flat_number address["flat_number"]
json.level_number address["level_number"]
json.number_first address["number_first"]
json.number_last address["number_last"]
json.street_name address["street_name"]
json.street_type address["street_type"]
json.street_suffix address["street_suffix"]
json.suburb address["locality_name"]
json.postcode address["postcode"]
json.state address["state"]
json.longitude address["longitude"]
json.latitude address["latitude"]
```

The above is a shared partial that will be used by both autocomplete and reverse geolocation.

```ruby
# app/views/address_autocomplete/index.jbuilder
json.partial! 'addresses/address', collection: @addresses, as: :address
```

<hr />

## Reverse geolocation

Another feature that we'll implement is the ability to search for addresses near a given
longitude and latitude.

Let's update the address model to support reverse geocode searches.

```ruby
class Address
  # ...

  def self.reverse_geocode(longitude, latitude, within)
    within = 1 if within.blank? || within <= 0

    Address.search(
      where: {
        location: {
          near: {
            lon: longitude.to_f,
            lat: latitude.to_f
          },
          within: "#{within}m",
        }
      }
    )
  end
end
```

Finally, to finish this off let's implement the route, controller and view.


```ruby
# app/controllers/address_autocomplete_controller.rb
Rails.application.routes.draw do
  get "/coordinates/reversegeocode", controller: :reverse_geocode, action: :index
end
```

```ruby
class ReverseGeocodeController < ActionController::API
  def index
    @addresses = Address.reverse_geocode(params[:lng], params[:lat], params[:within])
  end
end
```

Our API will accept the params `longitude`, `latitude` and `within`. The within
params accepts an integer. It allows us to filter addresses within a distance in
meters from the longitude and latitude.

```ruby
# app/views/reverse_geocode/index.jbuilder
json.partial! 'addresses/address', collection: @addresses, as: :address
```

<hr />

That completes our minimal Australian address API. As mentioned above, there are API's
available that have a daily free limit and are fairly cheap. Depending on your situation
it might be better to just use those to save time.

