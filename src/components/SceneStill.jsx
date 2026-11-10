import { useEffect, useState } from "react";
import { getImageUrl } from "../lib/images";

// The still from the scene where a word was saved in Watch, if there is one.
export default function SceneStill({ base }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let live = true;
    let created = null;
    setUrl(null);
    getImageUrl(base).then((u) => {
      if (live) {
        created = u;
        setUrl(u);
      } else if (u) {
        URL.revokeObjectURL(u);
      }
    });
    return () => {
      live = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [base]);

  return url ? <img className="scene-still" src={url} alt="The scene where you saved this word" /> : null;
}
