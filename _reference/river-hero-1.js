<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page not found — River</title>
  <link rel="preload" href="/assets/fonts/inter-tight-var-normal-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/assets/fonts/fonts.css?v=1" />
  <link rel="icon" type="image/png" href="/assets/favicon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png" />
  <link rel="stylesheet" href="/styles.css?v=43" />
  <style>
    /* Self-contained 404 layout — keeps the change off styles.css / other pages. */
    .nf {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 140px var(--pad-x) 90px;
      box-sizing: border-box;
    }
    /* Tiny minimal fish — outline only, dot eye, same spirit as the footer koi. */
    .nf-fish {
      width: 66px; height: auto;
      color: var(--accent);
      margin-bottom: 26px;
      animation: nf-bob 4.5s ease-in-out infinite;
    }
    @keyframes nf-bob {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50%      { transform: translateY(-9px) rotate(-3deg); }
    }
    .nf-eyebrow {
      margin: 0;
      font-family: var(--type-mono);
      font-size: 12px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--ink-3);
    }
    .nf-title {
      margin: 12px 0 0;
      font-family: var(--type-sans);
      font-weight: 300;
      font-size: clamp(32px, 5vw, 54px);
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .nf-title em {
      font-family: var(--type-serif);
      font-style: italic;
      font-weight: 400;
    }
    .nf-lede {
      margin: 16px 0 0;
      max-width: min(44ch, 100%);
      font-family: var(--type-sans);
      font-weight: 300;
      font-size: clamp(16px, 1.6vw, 19px);
      line-height: 1.55;
      color: var(--ink-2);
      opacity: 0.72;
    }
    .nf-cta {
      margin-top: 32px;
      font-family: var(--type-mono);
      font-size: 13px;
      letter-spacing: 0.04em;
      color: var(--accent);
      border-bottom: 1px solid currentColor;
      padding-bottom: 2px;
      transition: color 200ms ease;
    }
    .nf-cta:hover { color: var(--accent-hover); }
    @media (prefers-reduced-motion: reduce) { .nf-fish { animation: none; } }
  </style>
</head>
<body>
  <nav class="nav scrolled">
    <a href="/" class="wordmark" aria-label="River.ai home">
      <svg class="logo" viewBox="51 75 709 176" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M290 96.9999C290 137.317 257.344 170.066 216.875 170.066H160L166.216 145.171C168.44 136.265 176.441 130.016 185.62 130.016H216.875C235.169 130.015 250 115.222 250 96.9741V93.005C250 91.3462 251.346 90.0022 253.005 90.005L287.005 90.0613C288.66 90.064 290 91.4064 290 93.0613V96.9999Z" fill="currentColor"/><path d="M51.0004 163.066C51.0004 122.75 83.6561 90.0004 124.125 90.0002H176.159C178.11 90.0002 179.542 91.8337 179.069 93.7269L171.514 123.989C170.624 127.551 167.424 130.051 163.752 130.051H124.125C105.831 130.051 91.0004 144.844 91.0004 163.092V167.033C91.0004 168.69 89.6572 170.033 88.0004 170.033H54.0004C52.3435 170.033 51.0004 168.69 51.0004 167.033V163.066Z" fill="currentColor"/><path d="M51.0002 243.334C51.0002 203.017 83.6559 170.268 124.125 170.268L160 170L151.496 204.017C150.614 207.543 147.467 210.031 143.833 210.076L124.125 210.318C105.831 210.319 91.0002 225.112 91.0002 243.36V247.329C91.0002 248.988 89.654 250.332 87.9952 250.329L53.9952 250.273C52.3403 250.27 51.0002 248.928 51.0002 247.273V243.334Z" fill="currentColor"/><path d="M290 177C290 217.317 257.344 250.066 216.875 250.066H140L145.27 228.96C148.05 217.827 158.051 210.016 169.525 210.016H216.875C235.169 210.015 250 195.222 250 176.974V173.005C250 171.346 251.346 170.002 253.005 170.005L287.005 170.061C288.66 170.064 290 171.406 290 173.061V177Z" fill="currentColor"/><path d="M360.143 240V177.852C360.143 139.753 379.907 120.465 410.148 120.465H412.529V143.087H410.148C393.004 143.087 383.479 154.278 383.479 177.852V240H360.143ZM424.5 90.2246C424.5 81.8905 430.929 75.9376 438.787 75.9376C446.645 75.9376 452.836 82.3668 452.836 90.2246C452.836 98.0825 446.645 104.512 438.787 104.512C430.929 104.512 424.5 98.0825 424.5 90.2246ZM427.119 240V120.942H450.455V240H427.119ZM505.391 240L457.529 120.942H482.056L517.059 209.759L552.3 120.942H576.826L528.726 240H505.391ZM635.06 119.037C666.016 119.037 695.542 142.372 696.494 178.328C696.494 182.376 696.256 185.948 695.78 189.043H599.581C601.486 206.902 616.011 219.284 635.06 219.284C646.728 219.284 656.253 215.236 663.634 207.378L691.494 207.616C681.017 228.332 659.586 241.905 635.775 241.905C602.2 242.619 573.864 213.807 574.579 180.709C573.864 147.611 601.962 118.322 635.06 119.037ZM599.581 169.994H671.492C666.968 153.564 652.681 141.658 635.775 141.658C617.678 141.658 604.105 153.087 599.581 169.994ZM707.096 240V177.852C707.096 139.753 726.86 120.465 757.101 120.465H759.482V143.087H757.101C739.956 143.087 730.432 154.278 730.432 177.852V240H707.096Z" fill="currentColor"/></svg>
    </a>
    <div class="nav-links">
      <a href="/api">API</a>
      <a href="/blog">Blog</a>
      <a href="/careers">Careers</a>
    </div>
  </nav>

  <main class="nf">
    <!-- tiny minimal fish: outline body, triangle tail, one dot for an eye -->
    <svg class="nf-fish" viewBox="0 0 60 32" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
      <path d="M6 16 C 12 7, 34 7, 42 16 C 34 25, 12 25, 6 16 Z" />
      <path d="M42 16 L 54 9 L 54 23 Z" />
      <circle cx="14" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </svg>
    <p class="nf-eyebrow">404</p>
    <h1 class="nf-title">This page <em>swam off</em>.</h1>
    <p class="nf-lede">The link may be broken, or the page may have drifted downstream. Let's get you back to the current.</p>
    <a class="nf-cta" href="/">← Back to river.ai</a>
  </main>
</body>
</html>
