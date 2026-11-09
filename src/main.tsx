import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { IsolatedV13App } from './IsolatedV13App'
import './styles.css'
import './density.css'
import './v1r11.css'

createRoot(document.getElementById('root')!).render(<StrictMode>{import.meta.env.VITE_V13_ISOLATED === 'true' ? <IsolatedV13App /> : <App />}</StrictMode>)
