import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Card from '../components/Card'
import PageShell from '../components/PageShell'

export default function Home() {
  return (
    <PageShell
      title="Rug Artwork Studio"
      subtitle="Move from CAD uploads to production-ready color and texture mapping in one local-first workflow."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Read Old Artwork</p>
          <h2 className="text-xl font-semibold text-white">Browse saved artwork briefs</h2>
          <p className="text-sm text-slate-300">
            Open existing artworks from Firestore and inspect mapped poms, selected textures, and saved source images.
          </p>
          <Link to="/artworks" className="inline-flex">
            <Button variant="secondary">Open Artworks</Button>
          </Link>
        </Card>

        <Card className="space-y-4 border-teal-300/35 bg-teal-500/10">
          <p className="text-xs uppercase tracking-[0.24em] text-teal-100">Create New Artwork</p>
          <h2 className="text-xl font-semibold text-white">Upload CAD and build spec</h2>
          <p className="text-sm text-slate-200">
            Upload CAD, extract colors, map every color to a pom, select textures, and save as a structured artwork entry.
          </p>
          <Link to="/create" className="inline-flex">
            <Button>Create New Artwork</Button>
          </Link>
        </Card>
      </div>
    </PageShell>
  )
}
