/**
 * Bio component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import React from "react"
import { useStaticQuery, graphql } from "gatsby"
import Image from "gatsby-image"

// import { rhythm } from "../utils/typography"

const Bio = () => {
  const data = useStaticQuery(graphql`
    query BioQuery {
      avatar: file(absolutePath: { regex: "/profile-pic.jpg/" }) {
        childImageSharp {
          fixed(width: 100, height: 100, quality: 100) {
            ...GatsbyImageSharpFixed
          }
        }
      }
      site {
        siteMetadata {
          author
          social {
            github
            dev
          }
        }
      }
    }
  `)

  const { author, social } = data.site.siteMetadata
  return (
    <div className="flex my-10">
      <Image
        className="mr-4 mb-0 rounded-full"
        fixed={data.avatar.childImageSharp.fixed}
        alt={author}
        style={{ minWidth: '100' }}
      />

      <div>
        <p>
          <strong>{author}</strong>
        </p>
        <div className="flex">
          <a
            className="text-blue-600 mr-1"
            href={`https://github.com/${social.github}`}
          >
            github
          </a>
          <a
            className="text-blue-600 mr-1"
            href={`https://dev.to/${social.dev}`}
          >
            dev.to
          </a>
        </div>
      </div>
    </div>
  )
}

export default Bio
