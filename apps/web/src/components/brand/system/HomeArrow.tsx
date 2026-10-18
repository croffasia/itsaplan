import { ArrowRight } from 'lucide-react';
import styles from './system.module.css';

export default function HomeArrow() {
  return <ArrowRight aria-hidden="true" className={`${styles.nudge} rtl:-scale-x-100`} />;
}
