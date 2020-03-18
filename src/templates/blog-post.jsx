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
        <article className="bg-white px-6 py-4 rounded shadow mb-8">
          <header>
            <h1 className="text-4xl font-black mt-8 mb-0">
              {post.frontmatter.title}
            </h1>
            <p className="text-lg leading-loose mb-8 text-gray-600">
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
          <Link
            className="text-2xl text-blue-600"
            to="/"
            rel="back"
          >
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
