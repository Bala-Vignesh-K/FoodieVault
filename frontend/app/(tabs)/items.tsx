import { ListScreen } from "../../src/ListScreen";

export default function Items() {
  return (
    <ListScreen
      title="To Order"
      subtitle="Dishes on your wishlist"
      type="item"
      emptyIcon="bag-handle"
      emptyTitle="Nothing to order"
      emptySub="Save specific dishes you want to try and order them via Swiggy"
      testIdPrefix="items"
    />
  );
}
