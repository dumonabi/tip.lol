import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { GiftPageView } from './pages/GiftPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/g/:id" element={<GiftPageView />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
