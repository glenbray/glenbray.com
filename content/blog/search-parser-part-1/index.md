---
title: Search Parser Part 1
date: "2020-03-17T08:29:00"
description: This is a custom description for SEO and Open Graph purposes, rather than the default generated excerpt. Simply add a description field to the frontmatter.
---

Out of the box, Elasticsearch provides its own [query parser](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html). But what if you wanted something similar to [googles search functionality](https://ahrefs.com/blog/google-advanced-search-operators/). In our case, we don't need all the features that come with Elasticsearch and we'd prefer to restrict functionality. So our plan is to build our own gem that can take a search expression then transform that and return an Elasticsearch query. 

The code for this article can be found [here](https://github.com/glenbray/elastic_parser).

I've split building this gem into two articles. The features we will work on are listed in part one below.

**Part 1**
- Term search - `term`
- Phrase search `"this is a phrase"`
- AND condition `cat dog` or `cat AND dog`

**[Part 2](https://dev.to/glenbray/search-parser-part-2-683)**
- OR Condition `cat OR dog`
- Not filter `-term`
- Grouped search `(cat dog) OR (crocodile fish)`


Before we start writing any code for a feature, we will start with tests. So we'll build this test first. Let's get started by creating the gem.

```bash
bundle gem elastic_parser
```

We're using the [Parslet gem](https://github.com/kschiess/parslet) to handle parsing so let's also update the `elastic_parser.gemspec` to add that dependency.

```ruby
spec.add_dependency "parslet"
```

---

# Term search

As mentioned above, we'll do this test first. So the first thing we'll do is create an integration test to build a query from a simple term expression.

The first thing we'll as we're doing this test first is to create an integration test.

```ruby
RSpec.describe ElasticParser do
  describe ".parse" do
    subject { ElasticParser.parse(query) }

    describe "simple query" do
      let(:query) { "word" }

      it "returns multi match query" do
        expected = {
          :query => {
            :bool => {
              :minimum_should_match => 1,
              :should => {
                :multi_match => {
                  :fields => ElasticParser::FIELDS,
                  :query => query
                }
              }
            }
          }
        }

        expect(subject).to eq(expected)
      end
    end
  end
end
```

For this spec, we'll pass in a simple term that is `word` and we're expecting the result to be an Elasticsearch query. I'll be performing a multi-match query in Elasticsearch against each multiple fields in a doc. That is more specific for my use case. 


Let's go ahead and create a spec for our Parser class

```ruby
require 'parslet/rig/rspec'

RSpec.describe ElasticParser::Parser do
  describe "term" do
    it "parses term" do
      expect(subject.term).to parse("a")
    end
  end
end
```


To get this spec to pass we'll create the Parser class and implement the `term` rule which will match any character

```ruby
require "parslet"

module ElasticParser
  class Parser < Parslet::Parser
    rule(:term) { match('.').repeat(1).as(:term) }
    rule(:query) { term.as(:query) }
    root(:query)

    def self.parse(raw_query)
      new.parse(raw_query)
    rescue Parslet::ParseFailed => e
      puts e.parse_failure_cause.ascii_tree
    end
  end
end
```


Now that the parser spec works, let's get the integration spec working. What we'll do now is take our parsed term and transform it into an Elasticsearch query.

We'll first start putting together our Transformer class. When the Parser runs it will generate a hash with key-value pairs from the rules that we have defined. We'll use the transformer class to take that hash and transform it into a Binary Tree.

```ruby
module ElasticParser
  class Transformer < Parslet::Transform
    rule(term: simple(:term)) do
      Nodes::LeafNode.new(term: term.to_s.downcase)
    end

    rule(query: subtree(:query)) { ElasticTree.new(query) }
  end
end
```


To construct our tree we'll need to set up our node classes. We'll first implement a base node class called `ElasticNode` here's what it looks like.

```ruby
module ElasticParser::Nodes
  class ElasticNode
    attr_accessor :left, :right, :parent

    def initialize(data, left = nil, right = nil, parent = nil)
      @data = data
      @left = left
      @right = right
      @parent = parent
    end

    def to_query
      raise "implement me!"
    end
  end
end
```

You'll notice the `left`, `right`, and `parent` accessors. These will store references to other nodes. As we are implementing a binary tree, we'll restrict the children to a maximum of two branches (`left`, `right`).



We'll now implement our  `LeafNode` that extends the `ElasticNode` which will store terms or phrases that are parsed.

```ruby
module ElasticParser::Nodes
  class LeafNode < ElasticNode
    def to_query
      _key, value = @data.to_a.flatten

      {
        bool: {
          should: {
            multi_match: {
              query: value,
              fields: ElasticParser::FIELDS
            }
          },
          minimum_should_match: 1
        }
      }
    end
  end
end

```

Now for the `ElasticTree` class. This class exists to store the root node and to call the `to_query` method on the root node.

```ruby
module ElasticParser
  class ElasticTree
    def initialize(tree)
      @root = tree
    end

    def to_query
      { query: @root.to_query }
    end
  end
end
```


All we need now to get out first integration test passing is to implement the `parse` method which is the entry point to the lib.

```ruby
module ElasticParser
  FIELDS = ["title", "content"]

  def self.parse(query)
    parse_tree = Parser.parse(query)
    elastic_tree = Transformer.new.apply(parse_tree)
    elastic_tree.to_query
  end
end
```

When we run the specs again the integration test should pass.

![rspec_1](https://dev-to-uploads.s3.amazonaws.com/i/yczjui6ueva513fbnszu.png)


---

# Phrase search

Now that we have our first integration test working, let's start extending the features of the library. We'll now be looking into generating phrase searches when a user adds quotations around some terms e.g `"this is a phrase"`.


Let's add our next integration spec

```ruby
RSpec.describe ElasticParser do
  describe ".parse" do
    #...
    
    describe "phrase search" do
      let(:query) { '"this is a phrase"' }

      it "returns match phrase query" do
        expected = {
          :query => {
            :bool => {
              :minimum_should_match => 1,
              :should => ElasticParser::FIELDS.map do |field|
                { match_phrase: { field => "this is a phrase" } }
              end
            }
          }
        }

        expect(subject).to eq(expected)
      end
    end
  end
end
```

We'll also update the parser spec.

```ruby
RSpec.describe ElasticParser::Parser do
  #...
  
  describe "#space" do
    it "parses space" do
      expect(subject.space).to parse(" ")
    end
  end

  describe "#space?" do
    it "parses empty string" do
      expect(subject.space?).to parse("")
    end

    it "parses space" do
      expect(subject.space?).to parse(" ")
    end
  end

  describe '#quote' do
    it 'parses quotes' do
      expect(subject.quote).to parse('"')
    end
  end
  
  describe '#phrase' do
    it 'parses words wrapped in quotes' do
      expect(subject.phrase).to parse('"a b c"')
    end
  end
 end
```



Now with these specs in place some changes need to be made to the parser to support phrases and get our tests working. The changes I've made to the parser code are listed below.

- Updated the `term` rule to support checking for spaces using regex. 

- Added a `quote` rule to check for quotation marks `"`.

- Added a phrase rule that reuses our other rules to check for phrases within a supplied string.

- Updated the query rule to return term or phrase.

- Added a value rule which will return a term or phrase. The phrase rule uses the term rule so we've moved `.as(:term)` from the term rule to the value rule. 

  

```ruby
module ElasticParser
  class Parser < Parslet::Parser
    rule(:space) { str(" ").repeat(1) }
    rule(:space?) { space.maybe }
    rule(:term) { match('[^\s"]').repeat(1) }
    rule(:quote) { str('"') }
    
    rule(:phrase) do
      (quote >> (term >> space?).repeat.as(:phrase) >> quote) >> space?
    end

    rule(:value) { (term.as(:term) | phrase) }
    rule(:query) { value.as(:query) }
    
    root(:query)
  end
end
```

Now our parser specs will now be passing.


![rspec_2](https://dev-to-uploads.s3.amazonaws.com/i/yog6uisgnfxma4n7mfqb.png)


Let's update the `LeafNode` class to handle phrases.

```ruby
module ElasticParser::Nodes
  class LeafNode < ElasticNode
    def inspect
      { data: @data.inspect }
    end

    def to_query
      key, value = @data.to_a.flatten

      case key
      when :term
        {
          bool: {
            should: {
              multi_match: {
                query: value,
                fields: ElasticParser::FIELDS
              }
            },
            minimum_should_match: 1
          }
        }
      when :phrase
        {
          bool: {
            minimum_should_match: 1,
            :should => ElasticParser::FIELDS.map do |field|
              { match_phrase: { field => value } }
            end
          }
        }
      end
    end
  end
end
```


You could also refactor this to two separate nodes (`TermNode`, `PhraseNode`) to remove the case statement. But we'll just go with the case statement.


We'll add the phrase rule to the transformer class that will transform the phrase hash into a leaf node. We've pass `phrase` as the key, which the case statement will match in the LeafNode's `to_query` method and will return the correct Elasticsearch query for a phrase.

```ruby
module ElasticParser
  class Transformer < Parslet::Transform
    #...
    
    rule(phrase: simple(:phrase)) do
      Nodes::LeafNode.new(phrase: phrase.to_s.downcase)
    end
  end
end
```

Now when we run all our specs again everything will pass.

![rspec_3](https://dev-to-uploads.s3.amazonaws.com/i/7k4q4wxqvf2nt3vn01ah.png)

---

# AND condition

Next up we'll work on implementing support for the `AND` operator. Spaces within a query will also act as an `AND` operator, with the exception of phrases.

A search expression may look like this `supplier "PCB boards"`. The expectation here is that we would like to perform a search where the content contains the terms `supplier` **AND** the phrase `PCB boards`.

To better visualize how a query is constructed let's have a look at what the parser does with a couple of expressions.

![Alt Text](https://dev-to-uploads.s3.amazonaws.com/i/144d7rcqis5imo6dqqvc.png)

Let's start working on this feature. As we've done before we'll start with an integration test.

```ruby
RSpec.describe ElasticParser do
  describe ".parse" do
    #...
    
    describe "AND query" do
      let(:search_terms) { ['supplier', 'dog'] }

      let(:expected) do
        {
          :query => {
            :bool => {
              :must => search_terms.map do |word|
                {
                  :bool => {
                    :minimum_should_match => 1,
                    :should => {
                      :multi_match => {
                        :fields => ElasticParser::FIELDS,
                        :query => word
                      }
                    }
                  }
                }
              end
            }
          }
        }
      end

      context "with space" do
        let(:query) { "supplier dog" }

        it "returns match phrase query" do
          expect(subject).to eq(expected)
        end
      end

      context "with AND operator" do
        let(:query) { "supplier AND dog"}

        it "returns match phrase query" do
          expect(subject).to eq(expected)
        end
      end
    end
  end
end
```


We'll add a few more parser specs as well.

```ruby
RSpec.describe ElasticParser::Parser do
  subject { ElasticParser::Parser.new }
  #...
  
  describe '#and_op' do
    it 'parses AND' do
      expect(subject.and_op).to parse(' AND ')
    end

    it 'parses space when AND is not provided' do
      expect(subject.and_op).to parse(' ')
    end
  end

  describe '#and_condition' do
    it 'parses with space' do
      expect(subject.and_condition).to parse('a b')
    end

    it 'parses with AND' do
      expect(subject.and_condition).to parse('a AND b')
    end
  end
end
```

Let's update the parser and add a couple of rules to handle the `AND` operator and generating a rule to parse `AND` conditions. It gets slightly more complicated as we've also introduced recursion. I'll explain how this works. 

1. Check for a value (term or phrase)
2. Check for an `AND` operator
3. Now we'll recursively  recheck 

If we look at the `and_condition` rule you can see that we first check for value (term or phrase). Then a check for an `AND` operation (spaces that are not apart of phrases are also considered as an `AND` operator). 

````ruby
require "parslet"

module ElasticParser
  class Parser < Parslet::Parser
    #...
    
    rule(:and_op)   { ((space >> str('AND') >> space) | space?) }

    rule(:and_condition) do
      (
        value.as(:left) >> and_op >> and_condition.as(:right)
      ).as(:and) | value
    end

    rule(:query) { and_condition.as(:query) }
  end
end
```


To handle operators, we'll create a new node for our tree called `OperatorNode`. Its responsibility will handle generating the correct Elasticsearch query for each operator type. For now, we'll have it generate an Elasticsearch `must` query.


```ruby

module ElasticParser::Nodes
  class OperatorNode < ElasticNode
    def to_elastic_op(data)
      case data
      when :and
        :must
      else
        raise "Unknown operator: #{operator}"
      end
    end

    def operator
      to_elastic_op(@data)
    end

    def to_query
      { bool: { operator => [left.to_query, right.to_query].flatten } }
    end
  end
end

```


We'll create a new rule in our transformer that will create our `OperatorNode` when it matches an `and` operator.


```ruby
module ElasticParser
  class Transformer < Parslet::Transform
    #...
    
    rule(and: { left: subtree(:left), right: subtree(:right) }) do
      node = Nodes::OperatorNode.new(:and, left, right)
      left.parent = node if left
      right.parent = node if right
    end
  end
end
```


We'll run our specs again and everything will pass.

![rspec_4](https://dev-to-uploads.s3.amazonaws.com/i/opw6610uwo1vx87psub6.png)


&ensp;

[CONTINUE TO PART 2](https://dev.to/glenbray/search-parser-part-2-683)

&ensp;

#### References

- https://github.com/kschiess/parslet
- http://kschiess.github.io/parslet/documentation.html
- http://recursion.org/query-parser
