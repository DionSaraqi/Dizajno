export default function DesignerLoading() {
  return (
    <div className="w-full h-screen flex flex-col bg-dizajno-bg overflow-hidden">
      {/* Top bar skeleton */}
      <div className="h-12 bg-dizajno-surface border-b border-dizajno-border flex items-center px-4 gap-3">
        <div className="h-7 w-24 bg-dizajno-elevated rounded-lg animate-pulse" />
        <div className="w-px h-6 bg-dizajno-border" />
        <div className="h-7 w-16 bg-dizajno-elevated rounded animate-pulse" />
        <div className="w-px h-6 bg-dizajno-border" />
        <div className="h-7 w-20 bg-dizajno-elevated rounded animate-pulse" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar skeleton */}
        <div className="w-56 bg-dizajno-surface border-r border-dizajno-border flex flex-col">
          {/* Sidebar header skeleton */}
          <div className="px-4 py-3 border-b border-dizajno-border">
            <div className="h-4 w-20 bg-dizajno-elevated rounded animate-pulse" />
          </div>

          {/* Fake item rectangles */}
          <div className="flex-1 p-2 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              >
                <div className="w-8 h-8 bg-dizajno-elevated rounded animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div
                    className="h-3 bg-dizajno-elevated rounded animate-pulse"
                    style={{ width: `${60 + Math.random() * 30}%` }}
                  />
                  <div className="h-2 w-12 bg-dizajno-elevated rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center area */}
        <div className="flex-1 relative flex items-center justify-center bg-dizajno-bg">
          <svg
            className="animate-spin h-8 w-8 text-dizajno-accent"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
