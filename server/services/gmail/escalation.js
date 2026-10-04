/**
 * Supervision Tasks Escalation & Aging Engine
 * Analyzes approaching deadlines, overdue status, aging matrix,
 * and escalation notifications.
 * 
 * MPSCSC Supervision Portal
 */

/**
 * Calculates deadline proximity and aging metrics for a list of tasks
 * @param {Array} tasks 
 * @param {Date} [referenceDate]
 */
function processTaskEscalations(tasks = [], referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date();
  const todayStr = now.toISOString().split('T')[0];

  const summary = {
    total: tasks.length,
    newTasks: 0,
    inProgress: 0,
    completed: 0,
    dueToday: 0,
    dueIn3Days: 0,
    overdue: 0,
    requiresConfirmation: 0,
    highPriority: 0,
    aging: {
      under3Days: 0,
      fourToSevenDays: 0,
      over7Days: 0
    },
    byDepartment: {
      HO: 0,
      DISTRICT_ADMIN: 0,
      RO: 0,
      OTHER_GOVT: 0
    }
  };

  const processedTasks = tasks.map(task => {
    const createdAt = new Date(task.created_at || now);
    const ageDays = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));

    let urgencyLevel = 'NORMAL';
    let daysToDue = null;
    let isOverdue = false;
    let isDueToday = false;
    let isDueIn3Days = false;

    // Check Department category
    const dept = task.department_category || 'OTHER_GOVT';
    summary.byDepartment[dept] = (summary.byDepartment[dept] || 0) + 1;

    // Status counts
    if (task.status === 'COMPLETED') {
      summary.completed++;
      urgencyLevel = 'COMPLETED';
    } else {
      if (task.status === 'NEW') summary.newTasks++;
      if (task.status === 'IN_PROGRESS') summary.inProgress++;

      // Priority
      if (task.priority === 'CRITICAL' || task.priority === 'HIGH') {
        summary.highPriority++;
      }

      // Check if timeline requires confirmation
      if (task.requires_confirmation) {
        summary.requiresConfirmation++;
      }

      // Aging breakdown
      if (ageDays <= 3) summary.aging.under3Days++;
      else if (ageDays <= 7) summary.aging.fourToSevenDays++;
      else summary.aging.over7Days++;

      // Due date calculations
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const diffMs = dueDate - now;
        daysToDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const dueDateStr = dueDate.toISOString().split('T')[0];

        if (diffMs < 0 && dueDateStr !== todayStr) {
          isOverdue = true;
          urgencyLevel = 'OVERDUE';
          summary.overdue++;
        } else if (dueDateStr === todayStr) {
          isDueToday = true;
          urgencyLevel = 'DUE_TODAY';
          summary.dueToday++;
        } else if (daysToDue > 0 && daysToDue <= 3) {
          isDueIn3Days = true;
          urgencyLevel = 'DUE_SOON';
          summary.dueIn3Days++;
        }
      }
    }

    return {
      ...task,
      ageDays,
      daysToDue,
      isOverdue,
      isDueToday,
      isDueIn3Days,
      urgencyLevel
    };
  });

  return {
    summary,
    tasks: processedTasks
  };
}

module.exports = {
  processTaskEscalations
};
