import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Rendu Markdown pour les réponses de l'assistant IA.
 * Gemini renvoie du Markdown (gras, titres, listes, séparateurs) :
 * ce composant le transforme en HTML stylé plutôt que de l'afficher brut.
 */
export default function ChatMarkdown({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:  ({ node, ...p }) => <p className="mb-2 last:mb-0" {...p} />,
        strong: ({ node, ...p }) => <strong className="font-semibold text-slate-900" {...p} />,
        em: ({ node, ...p }) => <em className="italic" {...p} />,
        h1: ({ node, ...p }) => <h1 className="text-base font-bold mt-3 mb-1.5 first:mt-0" {...p} />,
        h2: ({ node, ...p }) => <h2 className="text-base font-bold mt-3 mb-1.5 first:mt-0" {...p} />,
        h3: ({ node, ...p }) => <h3 className="text-sm font-bold mt-3 mb-1 first:mt-0" {...p} />,
        ul: ({ node, ...p }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...p} />,
        ol: ({ node, ...p }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...p} />,
        li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
        hr: ({ node, ...p }) => <hr className="my-3 border-slate-200" {...p} />,
        a:  ({ node, ...p }) => <a className="text-blue-600 underline" target="_blank" rel="noopener noreferrer" {...p} />,
        code: ({ node, ...p }) => <code className="bg-slate-200/70 rounded px-1 py-0.5 text-[0.85em]" {...p} />,
        table: ({ node, ...p }) => <table className="w-full text-xs border-collapse my-2" {...p} />,
        th: ({ node, ...p }) => <th className="border border-slate-300 px-2 py-1 bg-slate-100 text-left" {...p} />,
        td: ({ node, ...p }) => <td className="border border-slate-300 px-2 py-1" {...p} />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
