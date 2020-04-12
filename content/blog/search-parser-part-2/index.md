---
title: Search Parser Part 2
date: "2020-03-17T08:30:00"
description: ""
---

Continuing from [PART 1](/search-parser-part-1), we'll look to finish off the remaining features of our gem.

The code for this article can be found [here](https://github.com/glenbray/elastic_parser).

###[Part 1](/search-parser-part-1)

| Feature       | Example                    |
|---------------|----------------------------|
| Term Search   | `term`                     |
| Phrase Search | `"this is a phrase"`       |
| AND condition | `cat dog` or `cat AND dog` |

###Part 2

| Feature        | Example                         |
|----------------|---------------------------------|
| OR Condition   | `cat OR dog`                    |
| Not Filter     | `-term`                         |
| Grouped search | `(cat dog) OR (crocodile fish)` |

<br />

# OR condition

The image below should give you an idea of how a tree may look like after Parslet rules have been applied with our new `OR` operator.

![or_operator](https://dev-to-uploads.s3.amazonaws.com/i/y66cm1yrgiivz8tbwaqn.png)

As we did in part 1 we'll get started with an integration test.

```ruby
RSpec.describe ElasticParser do
  describe ".parse" do
    #...

    describe "OR query" do
      let(:search_terms) { ['supplier', 'dog'] }

      let(:expected) do
        {
          :query => {
            :bool => {
              :should => search_terms.map do |word|
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

      context "with OR operator" do
        let(:query) { "supplier OR dog"}

        it "returns match phrase query" do
          expect(subject).to eq(expected)
        end
      end
    end
  end
end

```



The parser spec can be updated to handle the `OR` operator.

```ruby
RSpec.describe ElasticParser::Parser do
  #...

  describe '#or_op' do
    it 'parses OR' do
      expect(subject.or_op).to parse(' OR ')
    end
  end

  describe '#or_condition' do
    it 'parses with OR' do
      expect(subject.or_condition).to parse('a OR b')
    end
  end
end

```

To get our parser spec working we'll make some changes to the parser class:

- Update `term` rule to ignore the `OR` operator.
- Create a rule to handle the `OR` operator.
- Create a rule to match an `OR` condition.
- Update query rule to call `or_condition`


```ruby
module ElasticParser
  class Parser < Parslet::Parser
    #...

    rule(:term) do
      str("OR").absent? >> match('[^\s"]').repeat(1)
    end

    rule(:or_op)   { (space >> str("OR") >> space) }

    rule(:or_condition) do
      (
        and_condition.as(:left) >> or_op >> or_condition.as(:right)
      ).as(:or) | and_condition
    end

    rule(:query) { or_condition.as(:query) }
  end
end
```

This may be a bit confusing if you've not done much recursion in a while (or at all).

When the or_condition is evaluated it will attempt to build a left subtree. It will first attempt to match an `AND` operator before attempting to match the `OR` operator. If it's unable to match the `OR` or `AND` operators, then it will fall back and match the `value` rule (`term` or `phrase`).

In the middle of the `or_condition` rule, it will then attempt to match an `OR` operator. Then for the right subtree, it will call itself and do what we did to the left subtree.

Let's make another update the transformer class to handle the `OR` operator.

```ruby
module ElasticParser
  class Transformer < Parslet::Transform
    rule(or: { left: subtree(:left), right: subtree(:right) }) do
      node = Nodes::OperatorNode.new(:or, left, right)
      left.parent = node if left
      right.parent = node if right
    end
  end
end
```


Finally we'll update the `OperatorNode` class to return the correct Elasticsearch operator for the `OR` operator.

```ruby
module ElasticParser::Nodes
  class OperatorNode < ElasticNode
    def to_elastic_op(data)
      case data
      when :and
        :must
      when :or
        :should
      else
        raise "Unknown operator: #{operator}"
      end
    end

    #...
  end
end
```


Now when we run our specs again:

![rspec_5](https://dev-to-uploads.s3.amazonaws.com/i/iq2gx64awjpxvy2toku0.png)

---

# NOT operator

The `NOT` operator is a special case. It differs from the other operator nodes as it is only applied to the term or phrase immediately after the operator. When we set the attributes on the node class, we're only going to set the `left` attribute and ignore the `right`.

The image below demonstrates the tree the parser will build for a given expression.

![not_operator](https://dev-to-uploads.s3.amazonaws.com/i/3bnzj6iifkdw985k4t42.png)

We'll add an integration test to handle the not operator.

```ruby
RSpec.describe ElasticParser do
  describe ".parse" do
    #...

    describe "NOT query" do
      let(:query) { "-dog"}

      let(:expected) do
        {
          :query => {
            :bool => {
              :must_not => {
                :bool => {
                  :minimum_should_match => 1,
                  :should => {
                    :multi_match => {
                      :fields => ElasticParser::FIELDS,
                      :query => 'dog'
                    }
                  }
                }
              }
            }
          }
        }
      end

      context "with NOT operator" do
        it "returns match phrase query" do
          expect(subject).to eq(expected)
        end
      end
    end
  end
end
```


We'll also update to the parser specs for the not operator.

```ruby
RSpec.describe ElasticParser::Parser do
  #...

  describe '#not_op' do
    it 'parses -' do
      expect(subject.not_op).to parse('-')
    end
  end

  describe '#not_condition' do
    it 'parses with -' do
      expect(subject.or_condition).to parse('a OR b')
    end
  end
end
```


Now let's make the changes to the parser class to get the parser specs working.

```ruby
require "parslet"

module ElasticParser
  class Parser < Parslet::Parser
    #...

    rule(:not_op)   { str('-') }

    rule(:not_condition) do
      (
        not_op >> value.as(:left) >> space.maybe
      ).as(:not) | value
    end

    rule(:and_condition) do
      (
        not_condition.as(:left) >> and_op >> and_condition.as(:right)
      ).as(:and) | not_condition
    end
  end
end
```

We'll create a new node to handle `NOT` operations. The `NotOperatorNode` will extend the `OperatorNode`. It overrides the `to_query` method and only generates a left subtree when building the Elasticsearch query.

```ruby
module ElasticParser::Nodes
  class NotOperatorNode < OperatorNode
    def to_query
      { bool: { must_not: left.to_query } }
    end
  end
end
```


Now let's update the transformer and add a new rule to handle the `NOT` operator.

```ruby
module ElasticParser
  class Transformer < Parslet::Transform
    rule(not: { left: subtree(:left) }) do
      node = Nodes::NotOperator.new(:not, left)
      left.parent = node if left
    end
  end
end
```

Let's run our specs again.

![rspec_6](https://dev-to-uploads.s3.amazonaws.com/i/euaf0zdwrby80iym2o2y.png)

---

# Grouped Search

The final feature we'll add is the abillity change the order or operations with parenthesis which works the same as how you would expect it to in maths. Anything within the parenthesis will be evaluated first.



Let's implement our final integration test.

```ruby
RSpec.describe ElasticParser do
  describe ".parse" do
    #...

    describe "Grouped query" do
      let(:query) { "(a b) OR (c (d e))" }

      let(:expected) do
        {
          :query => {
            :bool => {
              :should => [{
                :bool => {
                  :must => [{
                    :bool => {
                      :minimum_should_match => 1,
                      :should => {
                        :multi_match => {
                          :fields => ElasticParser::FIELDS,
                          :query => "a"
                        }
                      }
                    }
                  }, {
                    :bool => {
                      :minimum_should_match => 1,
                      :should => {
                        :multi_match => {
                          :fields => ElasticParser::FIELDS,
                          :query => "b"
                        }
                      }
                    }
                  }]
                }
              }, {
                :bool => {
                  :must => [{
                    :bool => {
                      :minimum_should_match => 1,
                      :should => {
                        :multi_match => {
                          :fields => ElasticParser::FIELDS,
                          :query => "c"
                        }
                      }
                    }
                  }, {
                    :bool => {
                      :must => [{
                        :bool => {
                          :minimum_should_match => 1,
                          :should => {
                            :multi_match => {
                              :fields => ElasticParser::FIELDS,
                              :query => "d"
                            }
                          }
                        }
                      }, {
                        :bool => {
                          :minimum_should_match => 1,
                          :should => {
                            :multi_match => {
                              :fields => ElasticParser::FIELDS,
                              :query => "e"
                            }
                          }
                        }
                      }]
                    }
                  }]
                }
              }]
            }
          }
        }
      end

      it 'generates a nested query' do
        expect(subject).to eq(expected)
      end
    end
  end
end
```

Now for the final parser specs.

```ruby
RSpec.describe ElasticParser::Parser do
  #...

  describe '#group' do
    it 'parses terms within parentheses' do
      expect(subject.group).to parse('(a b)')
    end

    it 'parses phrase within parentheses' do
      expect(subject.group).to parse('(a "b c")')
    end

    it 'parses more complicated nesting' do
      expect(subject.group).to parse('(b (c (d e)))')
    end
  end
end
```

The remaining changes we need to make to the parser are:

- Create rules for parenthesis
- Update the term rule to ignore the parenthesis
- Create a group rule that will match a group within an expression, otherwise match on `value` rule
- Update the `not_condition` rule to fall back to the `group` rule if no match made

```ruby
require "parslet"

module ElasticParser
  class Parser < Parslet::Parser
    #...

    rule(:lparen)   { str('(') }
    rule(:rparen)   { str(')') }

    rule(:term) do
      str("OR").absent? >> match('[^\s"()-]').repeat(1)
    end

    rule(:group) { (lparen >> or_condition >> rparen) | value }

    rule(:not_condition) do
      (
        not_op >> value.as(:left) >> space.maybe
      ).as(:not) | group
    end
  end
end
```

That's all we need to do for that one, so let's run the specs again.

![rspec_7](https://dev-to-uploads.s3.amazonaws.com/i/qepyknenysi1zyvfmz5l.png)


All specs are passing and we've implemented all the features that we want.

---

# How does the Elasticsearch query actually get generated?

Up until now, I have not gone into the details how we actually generate the Elasticsearch query from the tree that we generate with our node classes. This works by applying left to right recursion. Each node implements a `to_query` method.

We store the root node as a variable within the `ElasticTree` class which also implements a method `to_query`. If a node within the tree is an `OperatorNode` the queries that it generates will call the `left` and `right` attributes respectively. We evaluate the left branch first, then it will recursively go through each node until it gets to a leaf node.

The leaf node is the end of a branch within the tree that will return a `term` or `phrase`. As it traverses through each node it will build a hash the same shape as the tree and this hash that is returned is our Elasticsearch query that a library such as `Searchkick` will accept. If you're using Searchkick you'll need to use the [advanced search](https://github.com/ankane/searchkick#advanced-search) feature.


#### References

- https://github.com/kschiess/parslet
- http://kschiess.github.io/parslet/documentation.html
- http://recursion.org/query-parser
