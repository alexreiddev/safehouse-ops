import {createRoot} from 'react-dom/client'
import './index.css'
import App,{Guard} from './App'
createRoot(document.getElementById('root')).render(<Guard><App/></Guard>)
