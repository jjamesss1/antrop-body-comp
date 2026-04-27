# ISAK Body Comp

Aplicación web para calcular composición corporal siguiendo el protocolo antropométrico ISAK, estilo Francis Holway.

## Funcionalidades

- **Formulario completo ISAK**: básicos, diámetros, perímetros, pliegues cutáneos y longitudes (opcionales)
- **Z-scores PHANTOM** (Ross & Wilson, 1974) para todas las variables
- **Somatotipo Heath-Carter** (1990) con somatocarta interactiva
- **Fraccionamiento Kerr 5 componentes** (1988): piel, adiposa, muscular, ósea, residual
- **Harris-Benedict** (1919) con peso ajustado cuando aplica
- **Peso ideal OMS 1985**, IMC con percentil, BSA DuBois
- **Índice cintura/cadera** con semáforo de riesgo por sexo y edad
- **Áreas cross-seccionales** Heymsfield (brazo, muslo, pantorrilla)
- **Sumatorias de pliegues** (Σ3, Σ6, Σ8) con percentil
- **Cálculo en tiempo real** — los resultados se actualizan con cada campo
- **Comparación con medición anterior** — cargá un JSON anterior para ver las diferencias
- **Import/Export JSON** — guardá y cargá mediciones como archivos `.json`
- **Historial local** — las mediciones se guardan en el navegador (localStorage)
- **Autenticación** — sistema de cuentas con placeholder para Firebase/Supabase

## Uso

1. Abrí `index.html` directamente en el navegador (no requiere servidor)
2. Completá los datos del sujeto y las mediciones
3. Los resultados aparecen en tiempo real a la derecha
4. Para comparar con una medición anterior: **⇄ Anterior** → subí el JSON de la medición previa
5. Para guardar: **💾 Guardar** (historial local) o **↓ JSON** (descarga)

## GitHub Pages

Para publicar en GitHub Pages:
1. Subí la carpeta `body-composition-isak/` a tu repo
2. Activá GitHub Pages desde Settings → Pages → Deploy from branch → `main` → `/` (root)
3. O mové los archivos a la raíz del repo

## Activar autenticación y base de datos

### Opción 1: Firebase
1. Creá un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activá Authentication (Email/Password)
3. Completá `CONFIG.firebase` en `js/auth.js`
4. Cambiá `CONFIG.provider = 'firebase'`
5. Implementá `authLogin`, `authRegister`, `authLogout` con Firebase SDK

### Opción 2: Supabase
1. Creá un proyecto en [Supabase](https://supabase.com)
2. Completá `CONFIG.supabase` en `js/auth.js`
3. Cambiá `CONFIG.provider = 'supabase'`
4. Implementá las funciones con `@supabase/supabase-js`

## Estructura del proyecto

```
body-composition-isak/
├── index.html              ← Entrada principal (single page app)
├── css/
│   └── style.css           ← Estilos (tema oscuro clínico)
├── js/
│   ├── constants.js        ← Constantes PHANTOM + tablas de referencia
│   ├── calculations.js     ← Motor de cálculo puro (sin DOM)
│   ├── charts.js           ← Visualizaciones (Chart.js + Canvas nativo)
│   ├── ui.js               ← Binding DOM ↔ cálculos
│   ├── data.js             ← Schema JSON, import/export, historial
│   └── auth.js             ← Autenticación (placeholder configurable)
└── README.md
```

## Validación de cálculos

Todos los cálculos fueron validados contra una medición de referencia real (22/5/2024):

| Módulo | Estado | Precisión |
|--------|--------|-----------|
| Z-scores PHANTOM (28 variables) | ✅ 29/29 | ≤ 0.06 de diferencia |
| Somatotipo Heath-Carter | ✅ | Endo/Meso/Ecto exactos |
| Kerr 5 componentes | ✅ | < 1% por componente |
| Harris-Benedict | ✅ | 0.37% |
| IMC + BSA | ✅ | < 1% |
| ICC + riesgo | ✅ | Exacto |
| Áreas cross-seccionales | ✅ | Exactas |
| Sumatorias pliegues | ✅ | Exactas |

## Referencias

- Ross & Wilson (1974) — PHANTOM proportionality model
- Heath & Carter (1990) — Somatotype methodology
- Kerr (1988) — Five-component fractionation
- Martin et al. (1990) — Skeletal muscle mass estimation
- Drinkwater & Ross (1980) — Bone mass estimation
- Harris & Benedict (1919) — Basal metabolic rate
- DuBois & DuBois (1916) — Body surface area
- Heymsfield et al. (1982) — Cross-sectional areas
- Holway (2009) — Aplicaciones en cineantropometría
