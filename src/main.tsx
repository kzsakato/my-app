import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './density.css'
import './v1r11.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
