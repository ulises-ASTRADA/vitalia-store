"""Reproduce catalog extraction: python scripts/extract_catalog.py original.pdf.
Requires PyMuPDF and Pillow. This does not infer nutrition or stock claims.
"""
from pathlib import Path
import fitz, io, json, re, sys, unicodedata
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
doc = fitz.open(sys.argv[1])
products = []
audit = []

def category(name):
    n = unicodedata.normalize('NFKD', name.lower()).encode('ascii', 'ignore').decode()
    groups = [
        ('Alfajores y chocolates', ['alfajor','chocolate negro','chocolate blanco','marroc','bocadito','pistachino']),
        ('Galletitas y panificados', ['chalita','cookie','pepa','gallet','crackers','tostada','budin','bizcoch','pan dulce','magdalena','grisines']),
        ('Barritas', ['barra','barrita','turron']),
        ('Granolas y cereales', ['granola','cereal','avena','copos','quinoa pop','arroz inflado','almohadita']),
        ('Frutos secos y semillas', ['mix','almendra','nuez','nueces','castaña','castana','mani','semilla','pasas','pistacho','girasol','chia','lino','zapallo','banana deshidrat','fruta deshidrat','arandano']),
        ('Untables y dulces', ['pasta','crema','mermelada','miel','dulce','mantequilla']),
        ('Snacks', ['nacho','snack','maiz','garbanzo','papas','chizito']),
    ]
    for label, needles in groups:
        if any(s in n for s in needles): return label
    return 'Almacén'

for page_no, page in enumerate(doc, 1):
    blocks = page.get_text('dict')['blocks']
    spans = [s for b in blocks if b['type'] == 0 for l in b['lines'] for s in l['spans']]
    markers = sorted([s for s in spans if s['bbox'][0] < 55 and re.fullmatch(r'\d+',s['text'].strip())], key=lambda s:s['bbox'][1])
    for idx, marker in enumerate(markers):
        number = int(marker['text'])
        top = marker['bbox'][1] - 4
        bottom = markers[idx+1]['bbox'][1] - 4 if idx+1 < len(markers) else page.rect.height
        detail = sorted([s for s in spans if 160 < s['bbox'][0] < 470 and top <= s['bbox'][1] < bottom], key=lambda s:(round(s['bbox'][1]),s['bbox'][0]))
        name = ' '.join(s['text'].strip() for s in detail if s['size'] > 13)
        desc = [s['text'].strip() for s in detail if s['size'] <= 13]
        price_spans = [s for s in spans if s['bbox'][0] >= 470 and top <= s['bbox'][1] < bottom and '$' in s['text']]
        assert len(price_spans) == 1, (number, price_spans)
        raw_price = price_spans[0]['text'].strip()
        assert re.fullmatch(r'\$\s*\d+',raw_price), (number,raw_price)
        price = int(re.sub(r'[^0-9]', '', raw_price))
        images = [b for b in blocks if b['type'] == 1 and b['bbox'][0] >= 55 and b['bbox'][2] <= 162 and top <= b['bbox'][1] < bottom]
        assert len(images) == 1, (number,len(images))
        image_path = f'/images/product-{number:03}.webp'
        im = Image.open(io.BytesIO(images[0]['image'])).convert('RGB')
        im.save(ROOT / 'public' / image_path.lstrip('/'), 'WEBP', quality=88)
        sku = next((s.split(':',1)[1].strip() for s in desc if s.startswith('SKU') and ':' in s), '')
        description = '\n'.join(s for s in desc if not s.startswith('SKU'))
        package = ''
        for line in description.split('\n'):
            match = re.match(r'(?i)^(?:por\s*|×)?((?:caja\s*(?:de\s*)?)?\d+(?:[.,/]\d+)?\s*(?:kgr\.?|kgs?|kl|gramos?|grs?|g|ml|cc|cm3|lt|litros?|l|unidades|unidad|unid\w*|u\b))(?:\b|$)',line)
            if match:
                package = match.group(1)
                break
        if not package:
            match=re.search(r'(?i)(caja\s*\d+\s*unidades)',name)
            if match: package=match.group(1)
        if not package and re.fullmatch(r'(?i)\d+(?:[/.,]\d+)?\s*(kg|kl|g|gr|unidades)',sku): package=sku
        notes=[]
        if not package: notes.append('Confirmar presentación de venta.')
        if re.search(r'(?i)kl\b',package): notes.append('El PDF dice «kl»; confirmar si corresponde a kg.')
        notes.append('Stock no informado en el PDF.')
        assert name and price > 0, number
        group=category(name)
        if number in range(45,46+1) or number in range(175,200): group='Granolas y cereales'
        if number in range(220,240) or number in range(1,23): group='Galletitas y panificados'
        if number in range(47,83) and number not in [48,49,50,51,59,60,61,62]: group='Frutos secos y semillas'
        if number in [49,268]: group='Frutos secos y semillas'
        if number in range(114,120) or number in range(240,251) or number in [50,89,90,92,173,170,200,201,202,265,266,267]: group='Harinas, pastas y legumbres'
        if number in range(96,108) or number in [91,95,172,260,261,262,263,264,274]: group='Especias y condimentos'
        if number in [51,86,87,88,167,168,169,269,270,271,272,273] or number in range(215,220): group='Infusiones'
        if number in range(124,130) or number in range(137,146) or number in range(251,260): group='Aceites y conservas'
        if number in range(148,153) or number in range(203,215): group='Untables y dulces'
        if number in range(108,114) or number in range(158,167): group='Suplementos'
        if number in [130,131,132,133,134,135]: group='Alfajores y chocolates'
        # Preserve source claims in the audit; do not republish unverified therapeutic claims.
        if number in [109,111,112,113,163,167,168,169]:
            description = f'Presentación: {package}.' if package else ''
            notes.append('Texto de propiedades del PDF pendiente de validación; no publicado en la tienda.')
        active = number not in [161,166]
        if not active: notes.append('Publicación pendiente de revisión de comercialización.')
        display_name = name
        if number == 1: display_name='Pepas proteicas de almendra sabor banana'
        products.append(dict(id=f'N{number:03}', nombre=display_name, descripcion=description, categoria=group, precio=price, presentacion=package, imagen=image_path, disponibilidad='consultar', activo=active, pagina_pdf=page_no, sku_original=sku, revision=' '.join(notes)))
        audit.append(dict(id=f'N{number:03}', pagina=page_no, nombre_original=name, precio_original=raw_price, detalle_original=desc, imagen_bbox=images[0]['bbox']))

assert [p['id'] for p in products] == [f'N{i:03}' for i in range(1,296)]
logo = next(b for b in doc[0].get_text('dict')['blocks'] if b['type']==1 and b['bbox'][0]<55)
logo_image = Image.open(io.BytesIO(logo['image'])).convert('RGBA')
if logo.get('mask'): logo_image.putalpha(Image.open(io.BytesIO(logo['mask'])))
logo_image.save(ROOT/'public/images/logo.png')
for path, value in [('data/catalog.json',products),('data/extraction-audit.json',audit)]:
    (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'products':len(products),'images':len(products),'missing_package':sum(not p['presentacion'] for p in products),'ambiguous_kl':sum('«kl»' in p['revision'] for p in products),'categories':{c:sum(p['categoria']==c for p in products) for c in sorted({p['categoria'] for p in products})}},ensure_ascii=False))
