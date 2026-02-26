"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewerController = void 0;
const common_1 = require("@nestjs/common");
const sessions_service_1 = require("../sessions/sessions.service");
let ViewerController = class ViewerController {
    sessionsService;
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
    }
    serveViewer(code, res) {
        const html = this.buildViewerHtml(code);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }
    async verifyAccess(code, body, res) {
        const session = await this.sessionsService.verifyAccess(code, body.accessCode);
        if (!session) {
            return res.status(401).json({ error: 'Código de acceso incorrecto' });
        }
        return res.json({
            name: session.name,
            type: session.type,
            createdAt: session.createdAt,
            scans: session.scans,
        });
    }
    buildViewerHtml(code) {
        return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inventario EAN</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: {
              50:  '#f0fdf4',
              100: '#dcfce7',
              200: '#bbf7d0',
              400: '#4ade80',
              500: '#22c55e',
              600: '#16a34a',
              700: '#15803d',
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-primary-50 min-h-screen font-sans">
  <div class="max-w-4xl mx-auto px-4 py-8">

    <!-- Pantalla de acceso -->
    <div id="accessScreen" class="flex flex-col items-center justify-center min-h-[60vh]">
      <div class="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <h1 class="text-xl font-bold text-gray-800">Inventario protegido</h1>
          <p class="text-gray-500 text-sm mt-1">Ingresá el código de acceso de 4 dígitos</p>
        </div>
        <div class="mb-4">
          <input
            id="accessCodeInput"
            type="text"
            inputmode="numeric"
            maxlength="4"
            placeholder="0000"
            class="w-full text-center text-3xl font-mono tracking-widest border-2 border-primary-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div id="accessError" class="hidden text-red-500 text-sm text-center mb-3">
          Código incorrecto. Intentá de nuevo.
        </div>
        <button
          onclick="verifyAccess()"
          class="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Acceder
        </button>
      </div>
    </div>

    <!-- Pantalla de inventario -->
    <div id="inventoryScreen" class="hidden">
      <div class="mb-6">
        <h1 id="sessionName" class="text-2xl font-bold text-gray-800"></h1>
        <div class="flex items-center gap-3 mt-2">
          <span id="sessionType" class="bg-primary-100 text-primary-700 text-sm font-medium px-3 py-1 rounded-full"></span>
          <span id="sessionDate" class="text-gray-500 text-sm"></span>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <span id="scanCount" class="text-sm font-medium text-gray-600"></span>
            <span id="lastUpdate" class="text-xs text-gray-400"></span>
          </div>
          <div class="flex items-center gap-2">
            <button
              onclick="fetchInventory()"
              id="refreshBtn"
              class="flex items-center gap-1 border border-primary-300 text-primary-600 hover:bg-primary-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg id="refreshIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Actualizar
            </button>
            <a
              href="/api/sessions/${code}/export"
              class="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              CSV
            </a>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-primary-50 text-primary-700 text-xs uppercase tracking-wide">
              <tr>
                <th class="text-left px-4 py-3">Código EAN</th>
                <th class="text-center px-4 py-3">Cantidad</th>
              </tr>
            </thead>
            <tbody id="scansTable" class="divide-y divide-gray-50"></tbody>
          </table>
        </div>
      </div>
    </div>

  </div>

  <script>
    const CODE = '${code}';
    let storedAccessCode = null;
    let pollingTimer = null;

    // Restaurar sesión previa
    const cached = sessionStorage.getItem('viewer_' + CODE);
    if (cached) {
      storedAccessCode = sessionStorage.getItem('viewer_ac_' + CODE);
      renderInventory(JSON.parse(cached));
      startPolling();
    }

    async function verifyAccess() {
      const accessCode = document.getElementById('accessCodeInput').value.trim();
      if (accessCode.length !== 4) return;

      const btn = document.querySelector('#accessScreen button');
      btn.disabled = true;
      btn.textContent = 'Verificando...';

      try {
        const data = await callVerify(accessCode);
        if (!data) {
          document.getElementById('accessError').classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = 'Acceder';
          return;
        }
        storedAccessCode = accessCode;
        sessionStorage.setItem('viewer_ac_' + CODE, accessCode);
        sessionStorage.setItem('viewer_' + CODE, JSON.stringify(data));
        renderInventory(data);
        startPolling();
      } catch {
        btn.disabled = false;
        btn.textContent = 'Acceder';
      }
    }

    async function callVerify(accessCode) {
      const res = await fetch('/i/' + CODE + '/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      });
      if (!res.ok) return null;
      return res.json();
    }

    async function fetchInventory() {
      if (!storedAccessCode) return;
      const icon = document.getElementById('refreshIcon');
      icon.style.animation = 'spin 1s linear infinite';
      try {
        const data = await callVerify(storedAccessCode);
        if (data) {
          sessionStorage.setItem('viewer_' + CODE, JSON.stringify(data));
          renderInventory(data);
        }
      } finally {
        icon.style.animation = '';
      }
    }

    function startPolling() {
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = setInterval(fetchInventory, 5000);
    }

    function renderInventory(data) {
      document.getElementById('accessScreen').classList.add('hidden');
      document.getElementById('inventoryScreen').classList.remove('hidden');

      document.getElementById('sessionName').textContent = data.name;
      document.getElementById('sessionType').textContent = data.type || 'General';
      document.getElementById('sessionDate').textContent = new Date(data.createdAt).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      document.getElementById('scanCount').textContent = data.scans.length + ' ítems';
      document.getElementById('lastUpdate').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const tbody = document.getElementById('scansTable');
      tbody.innerHTML = data.scans.map((s, i) => \`
        <tr class="\${i % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'}">
          <td class="px-4 py-3 font-mono text-gray-800">\${s.ean}</td>
          <td class="px-4 py-3 text-center font-semibold text-primary-700">\${s.quantity}</td>
        </tr>
      \`).join('');
    }

    document.getElementById('accessCodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') verifyAccess();
    });
  </script>
  <style>
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</body>
</html>`;
    }
};
exports.ViewerController = ViewerController;
__decorate([
    (0, common_1.Get)(':code'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ViewerController.prototype, "serveViewer", null);
__decorate([
    (0, common_1.Post)(':code/verify'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ViewerController.prototype, "verifyAccess", null);
exports.ViewerController = ViewerController = __decorate([
    (0, common_1.Controller)('i'),
    __metadata("design:paramtypes", [sessions_service_1.SessionsService])
], ViewerController);
//# sourceMappingURL=viewer.controller.js.map