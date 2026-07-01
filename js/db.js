// db.js - 数据库层（Dexie.js + IndexedDB）

const db = new Dexie('RoutePlannerDB');

db.version(1).stores({
  // 门店表：id自增，名称、地址、经纬度、任务数组、截止日期、备注
  stores: '++id, name, address, lat, lng, deadline, *tags',
  // 日历表：每天一条，类型 workday/offday/other
  calendar: 'date, type',
  // 计划表：每天一条，包含门店ID列表和路线顺序
  plans: 'date, *storeIds, confirmed'
});

// === 门店 CRUD ===

async function addStore(store) {
  // store: { name, address, lat, lng, tasks: [{title, done}], deadline, notes }
  return await db.stores.add(store);
}

async function updateStore(id, changes) {
  return await db.stores.update(id, changes);
}

async function deleteStore(id) {
  // 同时清理计划中对该门店的引用
  const plans = await db.plans.toArray();
  for (const plan of plans) {
    const idx = plan.storeIds.indexOf(id);
    if (idx !== -1) {
      plan.storeIds.splice(idx, 1);
      if (plan.routeOrder) {
        const rIdx = plan.routeOrder.indexOf(id);
        if (rIdx !== -1) plan.routeOrder.splice(rIdx, 1);
      }
      await db.plans.update(plan.date, { storeIds: plan.storeIds, routeOrder: plan.routeOrder });
    }
  }
  return await db.stores.delete(id);
}

async function getAllStores() {
  return await db.stores.toArray();
}

async function getStoreById(id) {
  return await db.stores.get(id);
}

// === 日历 CRUD ===

async function setDayType(date, type) {
  // type: 'workday' | 'offday' | 'other'
  const existing = await db.calendar.get(date);
  if (existing) {
    return await db.calendar.update(date, { type });
  }
  return await db.calendar.put({ date, type });
}

async function getDayType(date) {
  const record = await db.calendar.get(date);
  return record ? record.type : null;
}

async function getMonthCalendar(year, month) {
  // 获取某月所有标记记录
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return await db.calendar.where('date').startsWith(prefix).toArray();
}

// === 计划 CRUD ===

async function setPlan(date, storeIds, routeOrder) {
  const existing = await db.plans.get(date);
  if (existing) {
    return await db.plans.update(date, { storeIds, routeOrder, confirmed: false });
  }
  return await db.plans.put({ date, storeIds, routeOrder: routeOrder || storeIds, confirmed: false });
}

async function getPlan(date) {
  return await db.plans.get(date);
}

async function getMonthPlans(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return await db.plans.where('date').startsWith(prefix).toArray();
}

async function confirmPlan(date) {
  return await db.plans.update(date, { confirmed: true });
}

async function unconfirmPlan(date) {
  return await db.plans.update(date, { confirmed: false });
}

async function getAllPlans() {
  return await db.plans.toArray();
}
