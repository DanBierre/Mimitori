import { Component } from "react";
import { useT } from "../lib/store";

// Catches a crash inside one tab, so the rest of the app keeps working.
class Guard extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Tab crashed:", error, info?.componentStack);
  }

  render() {
    const { t, children } = this.props;
    if (!this.state.failed) return children;
    return (
      <section className="sheet review review--center" role="alert">
        <p className="review__big">{t("This page hit a snag")}</p>
        <p className="review__sub">{t("Your saved words are safe. Try again, or reload the app.")}</p>
        <div className="review__actions">
          <button className="btn btn--primary" onClick={() => this.setState({ failed: false })}>
            {t("Try again")}
          </button>
          <button className="btn btn--quiet" onClick={() => location.reload()}>
            {t("Reload")}
          </button>
        </div>
      </section>
    );
  }
}

export default function TabGuard({ children }) {
  return <Guard t={useT()}>{children}</Guard>;
}
