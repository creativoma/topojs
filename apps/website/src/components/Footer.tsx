function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="py-16" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="max-w-5xl mx-auto px-6 flex flex-col items-center gap-6 text-center">
        {/* Logo */}
        <span
          className="text-xl font-semibold tracking-tight"
          style={{ fontFamily: 'Fira Code, monospace', color: '#fff' }}
        >
          topojs
        </span>

        {/* Package list */}
        <div className="flex flex-wrap justify-center gap-2">
          {['@topojs/core', '@topojs/react', '@topojs/vite', '@topojs/cli'].map((pkg) => (
            <span
              key={pkg}
              className="text-xs px-2.5 py-1 rounded"
              style={{
                fontFamily: 'Fira Code, monospace',
                color: '#4d9bff',
                background: 'rgba(77,155,255,0.07)',
                border: '1px solid rgba(77,155,255,0.15)',
              }}
            >
              {pkg}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="w-24 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* Meta */}
        <div
          className="flex flex-wrap justify-center items-center gap-4 text-xs"
          style={{ color: '#3F3F46' }}
        >
          <span>MIT License</span>
          <span style={{ color: '#27272A' }}>·</span>
          <span>
            Built by{' '}
            <a
              href="https://github.com/creativoma"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: '#52525B' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#4d9bff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#52525B')}
            >
              Mariano Alvarez
            </a>
          </span>
          <span style={{ color: '#27272A' }}>·</span>
          <a
            href="https://github.com/creativoma/topojs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: '#3F3F46' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#4d9bff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#3F3F46')}
          >
            <GitHubIcon />
            creativoma/topojs
          </a>
        </div>

        {/* Tagline */}
        <p
          className="text-xs mt-2 italic"
          style={{ color: '#27272A', fontFamily: 'DM Sans, sans-serif' }}
        >
          State is a graph. Treat it like one.
        </p>
      </div>
    </footer>
  );
}
