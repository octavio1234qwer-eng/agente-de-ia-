import { api } from './api.js';
import { applyBrand } from './dom.js';
import './i18n.js';

api('/plans').then((data) => applyBrand(data.appName)).catch(() => {});
