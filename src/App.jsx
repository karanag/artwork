import { Navigate, Route, Routes } from 'react-router-dom'
import Artworks from './pages/Artworks'
import CreateArtwork from './pages/CreateArtwork'
import Home from './pages/Home'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateArtwork />} />
      <Route path="/artworks" element={<Artworks />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
