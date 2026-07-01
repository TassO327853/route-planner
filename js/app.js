// app.js - 主应用（Vue 3 + Vant 4）

const { createApp, ref, computed, watch, onMounted, nextTick } = Vue;
const { showToast, showConfirmDialog, showDialog, showSuccessToast, showFailToast, showLoadingToast, closeToast } = vant;

// ========== 日历页面组件 ==========
const CalendarPage = {
  template: `
    <div>
      <!-- 月份切换 -->
      <div class="date-header">
        <van-button icon="arrow-left" size="small" plain @click="prevMonth"></van-button>
        <span class="date-text">{{ currentYear }}年{{ currentMonth }}月</span>
        <van-button icon="arrow" size="small" plain @click="nextMonth"></van-button>
      </div>

      <!-- 星期头部 -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;padding:8px 12px;color:#969799;font-size:13px;">
        <span v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</span>
      </div>

      <!-- 日期格子 -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;padding:0 12px;">
        <div v-for="(day, idx) in calendarDays" :key="idx"
             class="day-cell"
             :class="dayClass(day)"
             @click="onDayClick(day)"
             style="padding:6px 0;cursor:pointer;border-radius:6px;margin:2px;">
          <span class="day-num" :style="{opacity: day.inMonth ? 1 : 0.3}">{{ day.day }}</span>
          <span v-if="day.type" class="day-dot"
                :class="{'day-workday': day.type==='workday', 'day-off': day.type==='offday', 'day-other': day.type==='other'}">
          </span>
          <span v-if="day.planCount > 0" style="font-size:10px;color:#1989fa;">{{ day.planCount }}店</span>
        </div>
      </div>

      <!-- 图例 -->
      <div style="display:flex;gap:16px;justify-content:center;padding:12px;font-size:12px;color:#646566;">
        <span><span class="day-dot day-workday" style="display:inline-block;"></span> 工作日</span>
        <span><span class="day-dot day-off" style="display:inline-block;"></span> 非工作日</span>
        <span><span class="day-dot day-other" style="display:inline-block;"></span> 其他安排</span>
      </div>

      <!-- 选中日期的操作 -->
      <van-action-sheet v-model:show="showDaySheet" :title="selectedDateText">
        <div style="padding:16px;">
          <van-cell-group>
            <van-cell title="设为工作日" is-link icon="clock-o" @click="setType('workday')">
              <template #right-icon><van-tag type="primary">工作日</van-tag></template>
            </van-cell>
            <van-cell title="设为非工作日" is-link icon="pause-circle-o" @click="setType('offday')">
              <template #right-icon><van-tag type="success">休息</van-tag></template>
            </van-cell>
            <van-cell title="其他安排" is-link icon="notes-o" @click="setType('other')">
              <template #right-icon><van-tag type="warning">其他</van-tag></template>
            </van-cell>
          </van-cell-group>
          <div v-if="selectedDatePlan" style="margin-top:16px;">
            <van-divider>当日计划</van-divider>
            <div v-for="(s, i) in selectedDateStores" :key="s.id" style="padding:6px 0;font-size:14px;">
              {{ i+1 }}. {{ s.name }}
              <span style="color:#969799;font-size:12px;">{{ s.address }}</span>
            </div>
            <van-button type="primary" size="small" block style="margin-top:12px;"
                        @click="goToPlan">查看完整计划</van-button>
          </div>
        </div>
      </van-action-sheet>
    </div>
  `,
  setup() {
    const now = new Date();
    const currentYear = ref(now.getFullYear());
    const currentMonth = ref(now.getMonth() + 1);
    const calendarDays = ref([]);
    const monthCalData = ref({});
    const monthPlanData = ref({});
    const showDaySheet = ref(false);
    const selectedDate = ref('');
    const selectedDatePlan = ref(null);
    const selectedDateStores = ref([]);

    const selectedDateText = computed(() => {
      if (!selectedDate.value) return '';
      const [y, m, d] = selectedDate.value.split('-');
      return `${y}年${parseInt(m)}月${parseInt(d)}日`;
    });

    function buildCalendar() {
      const year = currentYear.value;
      const month = currentMonth.value;
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const startWeek = firstDay.getDay();
      const daysInMonth = lastDay.getDate();

      const days = [];
      // 上月补齐
      const prevLast = new Date(year, month - 1, 0);
      for (let i = startWeek - 1; i >= 0; i--) {
        const d = prevLast.getDate() - i;
        const dt = `${year}-${String(month - 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, date: dt, inMonth: false, type: monthCalData.value[dt], planCount: monthPlanData.value[dt] || 0 });
      }
      // 本月
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, date: dt, inMonth: true, type: monthCalData.value[dt], planCount: monthPlanData.value[dt] || 0 });
      }
      // 下月补齐
      const remain = 42 - days.length;
      for (let d = 1; d <= remain; d++) {
        const dt = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, date: dt, inMonth: false, type: monthCalData.value[dt], planCount: monthPlanData.value[dt] || 0 });
      }
      calendarDays.value = days;
    }

    async function loadMonthData() {
      const cal = await getMonthCalendar(currentYear.value, currentMonth.value);
      const obj = {};
      cal.forEach(c => { obj[c.date] = c.type; });
      monthCalData.value = obj;

      const plans = await getMonthPlans(currentYear.value, currentMonth.value);
      const pobj = {};
      plans.forEach(p => { pobj[p.date] = (p.storeIds || []).length; });
      monthPlanData.value = pobj;

      buildCalendar();
    }

    function prevMonth() {
      if (currentMonth.value === 1) { currentYear.value--; currentMonth.value = 12; }
      else currentMonth.value--;
      loadMonthData();
    }

    function nextMonth() {
      if (currentMonth.value === 12) { currentYear.value++; currentMonth.value = 1; }
      else currentMonth.value++;
      loadMonthData();
    }

    function dayClass(day) {
      if (!day.type) return '';
      if (day.type === 'workday') return 'workday-bg';
      if (day.type === 'offday') return 'offday-bg';
      return 'other-bg';
    }

    async function onDayClick(day) {
      if (!day.inMonth) return;
      selectedDate.value = day.date;
      const plan = await getPlan(day.date);
      selectedDatePlan.value = plan;
      if (plan && plan.routeOrder && plan.routeOrder.length > 0) {
        const stores = [];
        for (const id of plan.routeOrder) {
          const s = await getStoreById(id);
          if (s) stores.push(s);
        }
        selectedDateStores.value = stores;
      } else {
        selectedDateStores.value = [];
      }
      showDaySheet.value = true;
    }

    async function setType(type) {
      await setDayType(selectedDate.value, type);
      showDaySheet.value = false;
      showToast('已标记为' + (type === 'workday' ? '工作日' : type === 'offday' ? '非工作日' : '其他'));
      loadMonthData();
    }

    function goToPlan() {
      showDaySheet.value = false;
      // 触发切换到计划 tab 并传入日期
      window._jumpToDate = selectedDate.value;
      document.querySelector('[data-tab="plan"]')?.click();
    }

    onMounted(() => loadMonthData());

    return {
      currentYear, currentMonth, calendarDays, showDaySheet,
      selectedDate, selectedDateText, selectedDatePlan, selectedDateStores,
      prevMonth, nextMonth, dayClass, onDayClick, setType, goToPlan
    };
  }
};

// ========== 门店管理页面组件 ==========
const StorePage = {
  template: `
    <div>
      <!-- 搜索栏 -->
      <van-search v-model="searchText" placeholder="搜索门店" @search="onSearch" />

      <!-- 门店列表 -->
      <van-cell-group v-if="filteredStores.length > 0">
        <van-swipe-cell v-for="store in filteredStores" :key="store.id">
          <van-cell :title="store.name" :label="store.address" is-link @click="editStore(store)">
            <template #value>
              <van-tag v-if="store.deadline" type="danger" size="small">{{ store.deadline }}</van-tag>
            </template>
          </van-cell>
          <template #right>
            <van-button square type="danger" text="删除" @click="onDelStore(store)" style="height:100%;" />
          </template>
        </van-swipe-cell>
      </van-cell-group>

      <!-- 空状态 -->
      <div v-else class="empty-wrap">
        <van-icon name="shop-o" />
        <p>还没有门店</p>
        <p style="font-size:12px;">点击右下角 + 添加</p>
      </div>

      <!-- 新增/编辑弹窗 -->
      <van-action-sheet v-model:show="showForm" :title="editId ? '编辑门店' : '新增门店'">
        <div style="padding:16px;">
          <van-form @submit="onSave">
            <van-cell-group inset>
              <van-field v-model="form.name" label="门店名称" placeholder="如：星巴克浦东店" required
                         :rules="[{required:true,message:'请输入门店名称'}]" />
              <van-field v-model="form.address" label="地址" placeholder="详细地址，用于路线规划" required
                         :rules="[{required:true,message:'请输入地址'}]" />
              <van-field v-model="form.deadline" label="截止日期" placeholder="点击选择" readonly is-link
                         @click="showDatePicker = true" />
              <van-field v-model="form.notes" label="备注" type="textarea" placeholder="其他说明" rows="2" autosize />
            </van-cell-group>

            <!-- 任务列表 -->
            <div style="padding:12px 16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;">门店任务</span>
                <van-button size="mini" icon="plus" type="primary" plain @click="addTask">添加</van-button>
              </div>
              <div v-for="(task, i) in form.tasks" :key="i" class="task-list-item">
                <van-field v-model="form.tasks[i]" :placeholder="'任务' + (i+1)" />
                <van-icon name="cross" color="#ee0a24" @click="form.tasks.splice(i,1)" style="cursor:pointer;" />
              </div>
              <div v-if="form.tasks.length === 0" style="color:#969799;font-size:13px;padding:8px 0;">
                点击"添加"录入该门店需要完成的工作
              </div>
            </div>

            <div style="padding:16px;">
              <van-button type="primary" block native-type="submit" :loading="saving">保存</van-button>
            </div>
          </van-form>
        </div>
      </van-action-sheet>

      <!-- 日期选择器 -->
      <van-popup v-model:show="showDatePicker" position="bottom" round>
        <van-date-picker v-model="datePickerVal" title="选择截止日期" @confirm="onDateConfirm"
                         @cancel="showDatePicker = false" />
      </van-popup>

      <!-- 浮动按钮 -->
      <div class="fab">
        <van-button round type="primary" icon="plus" size="large" @click="openAddForm"></van-button>
      </div>
    </div>
  `,
  setup() {
    const stores = ref([]);
    const searchText = ref('');
    const showForm = ref(false);
    const editId = ref(null);
    const saving = ref(false);
    const showDatePicker = ref(false);
    const datePickerVal = ref([]);
    const form = ref({ name: '', address: '', deadline: '', notes: '', tasks: [''] });

    const filteredStores = computed(() => {
      if (!searchText.value) return stores.value;
      const q = searchText.value.toLowerCase();
      return stores.value.filter(s =>
        s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
      );
    });

    async function loadStores() {
      stores.value = await getAllStores();
    }

    function openAddForm() {
      editId.value = null;
      form.value = { name: '', address: '', deadline: '', notes: '', tasks: [''] };
      showForm.value = true;
    }

    function editStore(store) {
      editId.value = store.id;
      form.value = {
        name: store.name,
        address: store.address,
        deadline: store.deadline || '',
        notes: store.notes || '',
        tasks: (store.tasks && store.tasks.length) ? [...store.tasks] : ['']
      };
      showForm.value = true;
    }

    function addTask() {
      form.value.tasks.push('');
    }

    function onDateConfirm({ selectedValues }) {
      form.value.deadline = selectedValues.join('-');
      showDatePicker.value = false;
    }

    async function onSave() {
      saving.value = true;
      const tasks = form.value.tasks.filter(t => t.trim());
      const data = {
        name: form.value.name.trim(),
        address: form.value.address.trim(),
        deadline: form.value.deadline,
        notes: form.value.notes.trim(),
        tasks: tasks.length ? tasks : []
      };

      try {
        // 尝试地理编码
        try {
          const coord = await Geocoding.addressToCoord(data.address);
          data.lat = coord.lat;
          data.lng = coord.lng;
        } catch (e) {
          // 地理编码失败不阻止保存，但给用户提示
          console.warn('地理编码失败:', e.message);
          showToast({ message: '地址解析失败，路线规划将不可用，请检查地址格式', position: 'top' });
        }

        if (editId.value) {
          await updateStore(editId.value, data);
          showSuccessToast('已更新');
        } else {
          await addStore(data);
          showSuccessToast('已添加');
        }
        showForm.value = false;
        loadStores();
      } catch (e) {
        showFailToast('保存失败');
      }
      saving.value = false;
    }

    async function onDelStore(store) {
      try {
        await showConfirmDialog({ title: '确认删除', message: '删除"' + store.name + '"？' });
        await deleteStore(store.id);
        showToast('已删除');
        loadStores();
      } catch {}
    }

    function onSearch() {}

    onMounted(() => loadStores());

    return {
      stores, searchText, filteredStores, showForm, editId, saving,
      showDatePicker, datePickerVal, form,
      openAddForm, editStore, addTask, onDateConfirm, onSave, onDelStore, onSearch
    };
  }
};

// ========== 计划页面组件 ==========
const PlanPage = {
  template: `
    <div>
      <!-- 日期选择 -->
      <div class="date-header">
        <van-button icon="arrow-left" size="small" plain @click="prevDay"></van-button>
        <span class="date-text" @click="showCalendarPicker=true">{{ currentDateText }}</span>
        <van-button icon="arrow" size="small" plain @click="nextDay"></van-button>
      </div>

      <!-- 当日状态标签 -->
      <div style="padding:8px 16px;">
        <van-tag v-if="dayType==='workday'" type="primary" size="medium">工作日</van-tag>
        <van-tag v-else-if="dayType==='offday'" type="success" size="medium">非工作日</van-tag>
        <van-tag v-else-if="dayType==='other'" type="warning" size="medium">其他安排</van-tag>
        <van-tag v-else plain type="primary" size="medium">未标记</van-tag>
        <van-tag v-if="plan && plan.confirmed" type="success" size="medium" style="margin-left:8px;">已确认</van-tag>
      </div>

      <!-- 操作按钮 -->
      <div style="display:flex;gap:8px;padding:0 16px 12px;" v-if="dayType==='workday'">
        <van-button size="small" type="primary" plain @click="autoAssign">自动排班</van-button>
        <van-button size="small" type="success" plain @click="optimizeRoute" v-if="plan && plan.storeIds && plan.storeIds.length > 1">优化路线</van-button>
        <van-button size="small" :type="plan && plan.confirmed ? 'warning' : 'success'"
                    @click="toggleConfirm" v-if="plan && plan.storeIds && plan.storeIds.length > 0">
          {{ plan && plan.confirmed ? '取消确认' : '确认计划' }}
        </van-button>
      </div>

      <!-- 路线摘要 -->
      <div v-if="routeResult && routeResult.totalDist > 0" class="route-summary">
        📍 最优路线：{{ routeResult.totalDist }} 公里，共 {{ routeResult.route.length }} 家门店
      </div>

      <!-- 路线详情 -->
      <div v-if="planStores.length > 0" class="route-card">
        <div v-for="(store, i) in planStores" :key="store.id">
          <div class="route-step">
            <span class="route-index">{{ i + 1 }}</span>
            <div class="route-info">
              <div class="route-name">{{ store.name }}</div>
              <div class="route-addr">{{ store.address }}</div>
              <div class="route-tasks">
                <van-tag v-for="t in (store.tasks || [])" :key="t" size="small" style="margin:2px;">{{ t }}</van-tag>
              </div>
              <div v-if="store.deadline" style="font-size:11px;color:#ee0a24;margin-top:4px;">
                截止：{{ store.deadline }}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-left:8px;">
              <van-icon name="arrow-up" v-if="i > 0" @click="moveStore(i, -1)" style="cursor:pointer;color:#1989fa;" />
              <van-icon name="arrow-down" v-if="i < planStores.length - 1" @click="moveStore(i, 1)" style="cursor:pointer;color:#1989fa;" />
              <van-icon name="cross" @click="removeStore(store)" style="cursor:pointer;color:#ee0a24;" />
            </div>
          </div>
          <div v-if="i < planStores.length - 1" class="route-arrow">↓</div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-wrap">
        <van-icon name="todo-list-o" />
        <p v-if="dayType==='workday'">暂无门店安排</p>
        <p v-else>请先将此日标记为工作日</p>
        <van-button v-if="dayType==='workday'" size="small" type="primary" plain style="margin-top:12px;"
                    @click="openPickStore">手动添加门店</van-button>
      </div>

      <!-- 日期选择弹窗 -->
      <van-popup v-model:show="showCalendarPicker" position="bottom" round>
        <van-calendar v-model="showCalendarPicker" @confirm="onCalendarConfirm" :show-confirm="false" />
      </van-popup>

      <!-- 选择门店弹窗 -->
      <van-action-sheet v-model:show="showPickStore" title="选择门店">
        <div style="padding:12px;">
          <van-checkbox-group v-model="pickedStoreIds">
            <van-cell-group>
              <van-cell v-for="s in allStores" :key="s.id" clickable
                        @click="togglePick(s.id)">
                <template #title>
                  <van-checkbox :name="s.id" shape="square">{{ s.name }}</van-checkbox>
                </template>
                <template #label>{{ s.address }}</template>
              </van-cell>
            </van-cell-group>
          </van-checkbox-group>
          <van-button type="primary" block style="margin-top:12px;" @click="confirmPick">确定</van-button>
        </div>
      </van-action-sheet>
    </div>
  `,
  setup() {
    const today = new Date();
    const currentDate = ref(formatDate(today));
    const dayType = ref(null);
    const plan = ref(null);
    const planStores = ref([]);
    const routeResult = ref(null);
    const allStores = ref([]);
    const showCalendarPicker = ref(false);
    const showPickStore = ref(false);
    const pickedStoreIds = ref([]);

    function formatDateStr(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    const currentDateText = computed(() => {
      const [y, m, d] = currentDate.value.split('-');
      return `${y}年${parseInt(m)}月${parseInt(d)}日`;
    });

    async function loadDay() {
      dayType.value = await getDayType(currentDate.value);
      plan.value = await getPlan(currentDate.value);
      routeResult.value = null;
      await loadPlanStores();
    }

    async function loadPlanStores() {
      const p = plan.value;
      if (!p || !p.routeOrder || p.routeOrder.length === 0) { planStores.value = []; return; }
      const stores = [];
      for (const id of p.routeOrder) {
        const s = await getStoreById(id);
        if (s) stores.push(s);
      }
      planStores.value = stores;
    }

    function prevDay() {
      const d = new Date(currentDate.value);
      d.setDate(d.getDate() - 1);
      currentDate.value = formatDateStr(d);
      loadDay();
    }

    function nextDay() {
      const d = new Date(currentDate.value);
      d.setDate(d.getDate() + 1);
      currentDate.value = formatDateStr(d);
      loadDay();
    }

    function onCalendarConfirm(date) {
      currentDate.value = formatDateStr(date);
      showCalendarPicker.value = false;
      loadDay();
    }

    async function autoAssign() {
      // 自动排班：把未分配的门店按截止时间分配到当前日期之前的工作日
      const stores = await getAllStores();
      if (stores.length === 0) { showToast('请先添加门店'); return; }

      // 获取当月所有工作日
      const [y, m] = currentDate.value.split('-').map(Number);
      const cal = await getMonthCalendar(y, m);
      const workdays = cal.filter(c => c.type === 'workday').map(c => c.date).sort();

      if (workdays.length === 0) { showToast('本月没有标记工作日'); return; }

      // 获取已有计划
      const existingPlans = await getMonthPlans(y, m);
      const assignedStoreIds = new Set();
      existingPlans.forEach(p => (p.storeIds || []).forEach(id => assignedStoreIds.add(id)));

      // 未分配的门店，按截止日期排序
      const unassigned = stores.filter(s => !assignedStoreIds.has(s.id))
        .sort((a, b) => (a.deadline || 'z').localeCompare(b.deadline || 'z'));

      if (unassigned.length === 0) {
        // 当前日期直接分配：手动选门店
        pickedStoreIds.value = (plan.value?.storeIds || []);
        allStores.value = stores;
        showPickStore.value = true;
        return;
      }

      // 分配逻辑：每个门店分配到截止日期之前最近的、负载最少的工作日
      const dayLoad = {};
      workdays.forEach(d => { dayLoad[d] = 0; });
      existingPlans.forEach(p => {
        if (dayLoad[p.date] !== undefined) dayLoad[p.date] = (p.storeIds || []).length;
      });

      for (const store of unassigned) {
        let candidates = workdays;
        if (store.deadline) {
          candidates = workdays.filter(w => w <= store.deadline);
        }
        if (candidates.length === 0) candidates = workdays;

        // 选负载最小的那天
        candidates.sort((a, b) => dayLoad[a] - dayLoad[b]);
        const targetDay = candidates[0];
        dayLoad[targetDay] = (dayLoad[targetDay] || 0) + 1;

        const existing = await getPlan(targetDay);
        const ids = existing ? [...(existing.storeIds || []), store.id] : [store.id];
        await setPlan(targetDay, ids, ids);
      }

      showToast(`已分配 ${unassigned.length} 家门店`);
      loadDay();
    }

    async function optimizeRoute() {
      const p = plan.value;
      if (!p || !p.storeIds || p.storeIds.length < 2) return;
      const stores = [];
      for (const id of p.storeIds) {
        const s = await getStoreById(id);
        if (s) stores.push(s);
      }
      const result = RouteOptimizer.optimize(stores);
      routeResult.value = result;
      await setPlan(currentDate.value, p.storeIds, result.route.map(s => s.id));
      await loadPlanStores();
      showToast('路线已优化');
    }

    async function toggleConfirm() {
      if (plan.value.confirmed) {
        await unconfirmPlan(currentDate.value);
      } else {
        await confirmPlan(currentDate.value);
      }
      loadDay();
    }

    async function openPickStore() {
      allStores.value = await getAllStores();
      pickedStoreIds.value = (plan.value?.storeIds || []);
      showPickStore.value = true;
    }

    function togglePick(id) {
      const idx = pickedStoreIds.value.indexOf(id);
      if (idx === -1) pickedStoreIds.value.push(id);
      else pickedStoreIds.value.splice(idx, 1);
    }

    async function confirmPick() {
      await setPlan(currentDate.value, [...pickedStoreIds.value], [...pickedStoreIds.value]);
      showPickStore.value = false;
      loadDay();
      showToast('已更新');
    }

    function onStoreAction(store, idx) {
      // 简单操作：移除
      showConfirmDialog({ title: '移除门店', message: '从今日计划中移除"' + store.name + '"？' }).then(async () => {
        const ids = plan.value.storeIds.filter(id => id !== store.id);
        const route = (plan.value.routeOrder || []).filter(id => id !== store.id);
        await setPlan(currentDate.value, ids, route);
        loadDay();
      }).catch(() => {});
    }

    async function moveStore(idx, direction) {
      const route = [...(plan.value.routeOrder || plan.value.storeIds)];
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= route.length) return;
      [route[idx], route[newIdx]] = [route[newIdx], route[idx]];
      await setPlan(currentDate.value, plan.value.storeIds, route);
      await loadDay();
    }

    async function removeStore(store) {
      try {
        await showConfirmDialog({ title: '移除门店', message: '从今日计划中移除"' + store.name + '"？' });
        const ids = plan.value.storeIds.filter(id => id !== store.id);
        const route = (plan.value.routeOrder || []).filter(id => id !== store.id);
        await setPlan(currentDate.value, ids, route);
        loadDay();
      } catch {}
    }

    // 监听从日历页跳转
    watch(() => window._jumpToDate, (val) => {
      if (val) {
        currentDate.value = val;
        window._jumpToDate = null;
        loadDay();
      }
    });

    onMounted(() => loadDay());

    return {
      currentDate, currentDateText, dayType, plan, planStores, routeResult,
      allStores, showCalendarPicker, showPickStore, pickedStoreIds,
      prevDay, nextDay, onCalendarConfirm, autoAssign, optimizeRoute,
      toggleConfirm, openPickStore, togglePick, confirmPick, onStoreAction,
      moveStore, removeStore
    };
  }
};

// ========== 设置页面组件 ==========
const SettingsPage = {
  template: `
    <div style="padding:16px;">
      <van-cell-group title="数据管理">
        <van-cell title="导出数据" is-link icon="down" @click="exportData" />
        <van-cell title="导入数据" is-link icon="upgrade" @click="importData" />
        <van-cell title="清空所有数据" is-link icon="delete-o" @click="clearData" label="不可恢复，请先导出备份" />
      </van-cell-group>

      <van-cell-group title="关于" style="margin-top:16px;">
        <van-cell title="版本" value="1.0.0" />
        <van-cell title="数据存储" value="浏览器本地 IndexedDB" />
        <van-cell title="地理编码" value="高德地图 JS API" />
      </van-cell-group>

      <input type="file" ref="fileInput" accept=".json" style="display:none;" @change="onFileChange" />
    </div>
  `,
  setup() {
    const fileInput = ref(null);

    async function exportData() {
      const data = {
        stores: await getAllStores(),
        calendar: await db.calendar.toArray(),
        plans: await getAllPlans()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `route-planner-backup-${formatDate(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccessToast('已导出');
    }

    function importData() {
      fileInput.value?.click();
    }

    async function onFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.stores) {
          for (const s of data.stores) {
            delete s.id;
            await db.stores.add(s);
          }
        }
        if (data.calendar) {
          for (const c of data.calendar) await db.calendar.put(c);
        }
        if (data.plans) {
          for (const p of data.plans) await db.plans.put(p);
        }
        showSuccessToast('导入成功');
      } catch {
        showFailToast('文件格式错误');
      }
      e.target.value = '';
    }

    async function clearData() {
      try {
        await showConfirmDialog({ title: '确认清空', message: '所有门店、日历标记和计划数据将被删除，不可恢复！' });
        await db.stores.clear();
        await db.calendar.clear();
        await db.plans.clear();
        showSuccessToast('已清空');
      } catch {}
    }

    return { exportData, importData, clearData, fileInput, onFileChange };
  }
};

// ========== 工具函数 ==========
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ========== 创建 Vue 应用 ==========
const app = createApp({
  setup() {
    const activeTab = ref(0);
    const pageTitles = ['日历', '门店管理', '每日计划', '设置'];
    const pageTitle = computed(() => pageTitles[activeTab.value]);

    // 监听从日历跳转到计划
    watch(activeTab, (val) => {
      if (val === 2) {
        nextTick(() => {
          // 触发计划页刷新（如果有跳转日期）
        });
      }
    });

    return { activeTab, pageTitle };
  }
});

// 注册组件
app.component('calendar-page', CalendarPage);
app.component('store-page', StorePage);
app.component('plan-page', PlanPage);
app.component('settings-page', SettingsPage);

// 注册 Vant 组件
app.use(vant);

// 挂载
app.mount('#app');

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
