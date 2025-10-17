import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <meta
          name="description"
          content="Elysian Trading System — AI-Powered Autonomous Trading Terminal"
        />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="robots" content="index, follow" />
        <meta charSet="UTF-8" />

        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />

        {/* Font Optimization */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <body className="bg-terminal-bg text-terminal-primary font-mono antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}