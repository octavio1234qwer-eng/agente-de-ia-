import { api } from './api.js';
import { applyBrand } from './dom.js';

api('/plans').then((data) => applyBrand(data.appName)).catch(() => {});
