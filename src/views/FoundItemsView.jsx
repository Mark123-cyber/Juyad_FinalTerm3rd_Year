import ItemListView from '../components/ItemListView'
import { useItems } from '../contexts/ItemContext'

export default function FoundItemsView() {
  const { items } = useItems()

  return (
    <ItemListView
      title="Found items"
      description="Items found on campus and waiting to be reunited with their owners."
      items={items.filter((item) => item.type === 'found')}
    />
  )
}
