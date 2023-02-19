import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta property="og:url"                content="https://oseiskar.github.io" />
          <meta property="og:title"              content="Otto Seiskari" />
          <meta property="og:description"        content="Personal web page. Selected open source projects, publications and computer graphics." />
          <meta property="og:image"              content="https://oseiskar.github.io/img/webgl-raytracer.png" />
          {/* Tiny Analytics */}
          <script defer src="https://app.tinyanalytics.io/pixel/xTQlswQewKufHeJY"></script>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
