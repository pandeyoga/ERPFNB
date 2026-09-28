/** Wrapper for /outlet/bdo route. */
import KdoBdoList from "./KdoBdoList";

export default function BdoPage() {
  return <div data-testid="bdo-page"><KdoBdoList kind="bdo" /></div>;
}
