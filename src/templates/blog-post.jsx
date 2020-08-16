import React from "react"
import { Link, graphql } from "gatsby"

import Bio from "../components/bio"
import Layout from "../components/layout"
import SEO from "../components/seo"
// import { scale } from "../utils/typography"

class BlogPostTemplate extends React.Component {
  render() {
    const post = this.props.data.markdownRemark
    const siteTitle = this.props.data.site.siteMetadata.title
    const { previous, next } = this.props.pageContext

    return (
      <Layout location={this.props.location} title={siteTitle}>
        <SEO
          title={post.frontmatter.title}
          description={post.frontmatter.description || post.excerpt}
        />
        <Bio />
        <article className="px-4 py-1 mb-8 bg-white rounded shadow md:px-12 md:py-4">
          <header>
            <h1 className="mt-8 mb-0 text-4xl font-black">
              {post.frontmatter.title}
            </h1>
            <p className="mb-8 text-lg leading-loose text-gray-600">
              {post.frontmatter.date}
            </p>
          </header>
          <section
            className="markdown"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
          <hr className="h-px mb-8" />
          <footer>
            <Bio />
          </footer>
        </article>

        <nav className="mb-8">
          <Link className="text-lg text-blue-600" to="/" rel="back">
            ← Back
          </Link>
        </nav>
      </Layout>
    )
  }
}

export default BlogPostTemplate

export const pageQuery = graphql`
  query BlogPostBySlug($slug: String!) {
    site {
      siteMetadata {
        title
      }
    }
    markdownRemark(fields: { slug: { eq: $slug } }) {
      id
      excerpt(pruneLength: 160)
      html
      frontmatter {
        title
        date(formatString: "DD MMMM, YYYY")
        description
      }
    }
  }
`
