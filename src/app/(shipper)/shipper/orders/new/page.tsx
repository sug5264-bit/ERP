import { redirect } from 'next/navigation'

export default function ShipperOrderNewRedirect() {
  redirect('/shipper/orders/online')
}
