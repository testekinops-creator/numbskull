import { useNavigate } from 'react-router-dom'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="screen">
      <div className={`panel ${styles.page} anim-slide-up`}>
        <div className="glow-breathe">
          <SkullMascot expression="judging" size={120} glow />
        </div>
        <h1 className={styles.code}>404</h1>
        <p className={styles.text}>The skull searched everywhere and found nothing here.</p>
        <button className="btn btn-juice btn-lg" onClick={() => navigate('/')}>Go Home</button>
      </div>
    </div>
  )
}
