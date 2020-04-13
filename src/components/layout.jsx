import React from "react"
import { Link } from "gatsby"

import Logo from "./logo"

class Layout extends React.Component {
  render() {
    const { location, title, children } = this.props
    const rootPath = `${__PATH_PREFIX__}/`
    let header

    if (location.pathname === rootPath) {
      header = (
        <h1 className="text-4xl font-black font-sans mb-10 mt-0">
          <Link className="shadow-none" to={`/`}>
            <Logo />

            {title}
          </Link>
        </h1>
      )
    } else {
      header = (
        <h3 className="text-2xl font-sans font-black mt-0">
          <Link className="shadow-none" to={`/`}>
            ← {title}
          </Link>
        </h3>
      )
    }

    return (
      <div className="max-w-3xl mx-auto px-2 py-10">
        <header>{header}</header>
        <main>{children}</main>
        <footer>© {new Date().getFullYear()} glenbray.com</footer>
      </div>
    )
  }
}

export default Layout
