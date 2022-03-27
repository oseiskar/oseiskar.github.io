import Document, { Html, Head, Main, NextScript } from 'next/document'

const GOOGLE_ANALYTICS_ID = 'UA-142197325-1';

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta property="og:url"                content="https://oseiskar.github.io" />
          <meta property="og:title"              content="Otto Seiskari" />
          <meta property="og:description"        content="Personal web page. Selected open source projects, publications and computer graphics." />
          <meta property="og:image"              content="https://oseiskar.github.io/img/webgl-raytracer.png" />
          {/* Global Site Tag (gtag.js) - Google Analytics */}
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS}', {
              page_path: window.location.pathname,
            });
          `,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
