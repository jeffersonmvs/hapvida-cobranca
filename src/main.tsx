import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ProvedorDados } from './dados/contexto'
import './estilos.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* BASE_URL vem do `base` do Vite: '/' no Netlify e em dev,
        '/hapvida-cobranca/' quando publicado no GitHub Pages. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ProvedorDados>
        <App />
      </ProvedorDados>
    </BrowserRouter>
  </React.StrictMode>,
)
