import NextLink from 'next/link';
import Icon from './icon';
import {ENVIOS_PAGE,SHIP_ZONES_LINE} from '../lib/product-pages';
const Link=NextLink.default||NextLink;

// Sin /envios todavía, la línea va sin "Ver zonas de envío" para no enlazar a un 404.
export default function ShipLine({band=false}) {
  return <p className={`ship-line${band?' ship-band':''}`}><Icon name="truck"/><span>{SHIP_ZONES_LINE}{ENVIOS_PAGE&&<> <Link href="/envios">Ver zonas de envío</Link></>}</span></p>;
}
