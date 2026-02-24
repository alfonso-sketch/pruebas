/**
 * Lógica de la Aplicación TaskMaster Pro
 */

// --- CONFIGURACIÓN ---
// REEMPLAZA ESTA URL CON LA DE TU WEB APP DESPLEGADA EN APPS SCRIPT
const API_URL = 'TU_URL_DE_WEB_APP_AQUI';

let tasks = [];
let currentView = 'list'; // 'list' o 'kanban'
let currentChecklist = [];

// --- ELEMENTOS DEL DOM ---
const listContainer = document.getElementById('list-container');
const kanbanContainer = document.getElementById('kanban-container');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const btnNewTask = document.getElementById('btn-new-task');
const checklistItemsDiv = document.getElementById('checklist-items');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterPriority = document.getElementById('filter-priority');
const toast = document.getElementById('toast');

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initEventListeners();
    fetchTasks();
});

function initEventListeners() {
    btnNewTask.addEventListener('click', () => openModal());

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    taskForm.addEventListener('submit', handleFormSubmit);

    document.getElementById('btn-add-item').addEventListener('click', addChecklistItem);

    document.getElementById('view-list').addEventListener('click', () => switchView('list'));
    document.getElementById('view-kanban').addEventListener('click', () => switchView('kanban'));

    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

    searchInput.addEventListener('input', renderTasks);
    filterStatus.addEventListener('change', renderTasks);
    filterPriority.addEventListener('change', renderTasks);
}

// --- API CALLS ---
async function fetchTasks() {
    if (API_URL.includes('TU_URL_DE_WEB_APP')) {
        showToast('⚠️ Por favor, configura la URL de la API en app.js');
        return;
    }

    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        if (result.success) {
            tasks = result.data;
            renderTasks();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ Error al cargar tareas');
    }
}

async function callAPI(action, payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        return result.data;
    } catch (error) {
        console.error('Error en API:', error);
        showToast('❌ Error en la operación');
        throw error;
    }
}

// --- RENDERIZADO ---
function renderTasks() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusVal = filterStatus.value;
    const priorityVal = filterPriority.value;

    const filtered = tasks.filter(t => {
        const matchesSearch = t.titulo.toLowerCase().includes(searchTerm) || t.descripcion.toLowerCase().includes(searchTerm);
        const matchesStatus = statusVal === 'Todos' || t.estado === statusVal;
        const matchesPriority = priorityVal === 'Todas' || t.prioridad === priorityVal;
        return matchesSearch && matchesStatus && matchesPriority;
    });

    if (currentView === 'list') {
        renderListView(filtered);
    } else {
        renderKanbanView(filtered);
    }
    lucide.createIcons();
}

function renderListView(tasksToRender) {
    listContainer.classList.remove('hidden');
    kanbanContainer.classList.add('hidden');

    if (tasksToRender.length === 0) {
        listContainer.innerHTML = '<div class="text-center py-10 text-gray-400">No se encontraron tareas</div>';
        return;
    }

    listContainer.innerHTML = tasksToRender.map(task => createTaskCard(task)).join('');
}

function renderKanbanView(tasksToRender) {
    listContainer.classList.add('hidden');
    kanbanContainer.classList.remove('hidden');

    const columns = ['Pendiente', 'En desarrollo', 'Finalizada'];
    columns.forEach(status => {
        const colTasks = tasksToRender.filter(t => t.estado === status);
        const container = document.querySelector(`.kanban-column[data-status="${status}"] .kanban-tasks`);
        container.innerHTML = colTasks.map(task => createTaskCard(task, true)).join('');
    });
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function createTaskCard(task, isKanban = false) {
    const isCompleted = task.estado === 'Finalizada';
    const statusClass = `status-badge-${task.estado.replace(/\s+/g, '-')}`;
    const priorityClass = `priority-${task.prioridad}`;

    // Parse checklist
    let checklistInfo = '';
    try {
        const items = JSON.parse(task.checklist || '[]');
        if (items.length > 0) {
            const completed = items.filter(i => i.completed).length;
            checklistInfo = `<div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <i data-lucide="check-circle" class="w-3 h-3"></i> ${completed}/${items.length} items
            </div>`;
        }
    } catch(e) {}

    let formattedDate = 'Sin fecha';
    if (task.fechaLimite) {
        const date = new Date(task.fechaLimite);
        if (!isNaN(date.getTime())) {
            formattedDate = date.toLocaleDateString();
        }
    }

    return `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 task-card ${priorityClass} ${isCompleted ? 'completed-task opacity-75' : ''} animate-fade-in transition-colors">
            <div class="flex justify-between items-start mb-2">
                <span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${escapeHTML(task.estado)}</span>
                <div class="flex gap-2">
                    <button onclick="editTask('${task.id}')" class="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="confirmDelete('${task.id}')" class="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
            <h4 class="font-bold text-gray-800 dark:text-white task-title mb-1">${escapeHTML(task.titulo)}</h4>
            <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">${escapeHTML(task.descripcion) || 'Sin descripción'}</p>

            ${checklistInfo}

            <div class="mt-4 pt-3 border-t dark:border-gray-700 flex justify-between items-center text-xs text-gray-400">
                <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> ${formattedDate}</span>
                <span class="font-medium text-indigo-500 dark:text-indigo-400">${escapeHTML(task.prioridad)}</span>
            </div>
        </div>
    `;
}

// --- LOGICA DE MODAL ---
function openModal(task = null) {
    taskForm.reset();
    currentChecklist = [];
    document.getElementById('task-id').value = task ? task.id : '';
    document.getElementById('modal-title').innerText = task ? 'Editar Tarea' : 'Nueva Tarea';

    if (task) {
        document.getElementById('task-title').value = task.titulo;
        document.getElementById('task-desc').value = task.descripcion;
        document.getElementById('task-status').value = task.estado;
        document.getElementById('task-priority').value = task.prioridad;
        document.getElementById('task-deadline').value = task.fechaLimite ? task.fechaLimite.split('T')[0] : '';
        document.getElementById('task-notify').checked = task.enviarEmail === true || task.enviarEmail === 'true';

        try {
            currentChecklist = JSON.parse(task.checklist || '[]');
        } catch(e) { currentChecklist = []; }
    }

    renderChecklist();
    taskModal.classList.remove('hidden');
    lucide.createIcons();
}

function closeModal() {
    taskModal.classList.add('hidden');
}

function renderChecklist() {
    checklistItemsDiv.innerHTML = '';
    currentChecklist.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg group transition-colors';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = item.completed;
        checkbox.className = 'w-4 h-4 text-indigo-600';
        checkbox.onchange = () => toggleItem(index);

        const span = document.createElement('span');
        span.className = `flex-1 text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`;
        span.textContent = item.text;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.onclick = () => removeItem(index);
        btn.className = 'text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition';
        btn.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';

        div.appendChild(checkbox);
        div.appendChild(span);
        div.appendChild(btn);
        checklistItemsDiv.appendChild(div);
    });
    lucide.createIcons();
}

function addChecklistItem() {
    const input = document.getElementById('new-item-text');
    const text = input.value.trim();
    if (text) {
        currentChecklist.push({ text, completed: false });
        input.value = '';
        renderChecklist();
    }
}

function toggleItem(index) {
    currentChecklist[index].completed = !currentChecklist[index].completed;

    // Si todos están completados, sugerir marcar como Finalizada (opcional)
    const allDone = currentChecklist.every(i => i.completed);
    if (allDone && currentChecklist.length > 0) {
        document.getElementById('task-status').value = 'Finalizada';
    }

    renderChecklist();
}

function removeItem(index) {
    currentChecklist.splice(index, 1);
    renderChecklist();
}

// --- ACCIONES ---
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const payload = {
        titulo: document.getElementById('task-title').value,
        descripcion: document.getElementById('task-desc').value,
        estado: document.getElementById('task-status').value,
        prioridad: document.getElementById('task-priority').value,
        fechaLimite: document.getElementById('task-deadline').value,
        enviarEmail: document.getElementById('task-notify').checked,
        checklist: JSON.stringify(currentChecklist)
    };

    const action = id ? 'update' : 'create';
    if (id) payload.id = id;

    try {
        showToast(id ? 'Actualizando...' : 'Creando...');
        await callAPI(action, payload);
        showToast('✅ Tarea guardada');
        closeModal();
        fetchTasks();
    } catch (error) {
        showToast('❌ Error al guardar');
    }
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) openModal(task);
}

async function confirmDelete(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta tarea?')) {
        try {
            showToast('Eliminando...');
            await callAPI('delete', { id });
            showToast('✅ Tarea eliminada');
            fetchTasks();
        } catch (error) {
            showToast('❌ Error al eliminar');
        }
    }
}

function switchView(view) {
    currentView = view;
    document.getElementById('view-list').classList.toggle('bg-white', view === 'list');
    document.getElementById('view-list').classList.toggle('text-indigo-600', view === 'list');
    document.getElementById('view-list').classList.toggle('text-gray-500', view === 'kanban');

    document.getElementById('view-kanban').classList.toggle('bg-white', view === 'kanban');
    document.getElementById('view-kanban').classList.toggle('text-indigo-600', view === 'kanban');
    document.getElementById('view-kanban').classList.toggle('text-gray-500', view === 'list');

    renderTasks();
}

function showToast(msg) {
    const toastMsg = document.getElementById('toast-msg');
    toastMsg.innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// --- DARK MODE ---
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateDarkIcon();
}

function updateDarkIcon() {
    const isDark = document.documentElement.classList.contains('dark');
    const icon = document.getElementById('dark-icon');
    if (isDark) {
        icon.setAttribute('data-lucide', 'sun');
    } else {
        icon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}

// Cargar preferencia
if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
}
updateDarkIcon();
