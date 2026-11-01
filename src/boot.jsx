import './main.jsx'
import {createRoot} from 'react-dom/client'
import Story from './story/Story.jsx'

// The story layer mounts in its own root beside the main app.
const el=document.createElement('div');el.id='story-root';document.body.appendChild(el)
createRoot(el).render(<Story/>)
