import styles from './ThankYou.module.css'
import telegram from './telegram.svg'
import lyricalIMG from '../Form/liricalIMG.webp'

export default function ThankYou() {
    return (
      <section className={styles.ThankYouSection}>
        <div className="">
          <h1 className={styles.title}>
            щоб завершити реєстрацію - переходь у мій телеграм канал!
          </h1>
          <p className={styles.text}>
            Це дуже важливо, бо це буде твоїм квитком на івент!
          </p>
          <a
            className={styles.linkToTelegram}
            href="https://t.me/+YijJsDqrnDw3MjMy"
            target="_blank"
          >
            перейти <img src={telegram} alt="telegram" />
          </a>
        </div>
        <img className={styles.imgggg} src={lyricalIMG} alt="" />
      </section>
    );
}