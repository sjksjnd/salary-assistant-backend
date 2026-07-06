const calcService = require('../src/services/calcService');

jest.mock('../src/services/configService', () => ({
  getConfig: async (key) => {
    if (key === 'min_wage') {
      return { '广东': 2300 };
    }
    return {};
  },
}));

describe('calcDailySalary', () => {
  test('day shift without overtime', async () => {
    const result = await calcService.calcDailySalary(25, 8, 8, 'day');
    expect(result).toBe(200);
  });

  test('day shift with overtime', async () => {
    const result = await calcService.calcDailySalary(25, 8, 10, 'day');
    expect(result).toBe(275);
  });

  test('night shift', async () => {
    const result = await calcService.calcDailySalary(25, 8, 8, 'night');
    expect(result).toBe(300);
  });
});

describe('calcSeverance', () => {
  test('normal case', async () => {
    const result = await calcService.calcSeverance(5, 5000, '广东');
    expect(result.amount).toBe(25000);
    expect(result.cappedSalary).toBe(5000);
    expect(result.cappedYears).toBe(5);
  });

  test('high salary cap', async () => {
    const result = await calcService.calcSeverance(5, 10000, '广东');
    expect(result.amount).toBe(34500);
    expect(result.cappedSalary).toBe(6900);
  });

  test('years cap', async () => {
    const result = await calcService.calcSeverance(15, 5000, '广东');
    expect(result.cappedYears).toBe(12);
    expect(result.amount).toBe(60000);
  });
});

describe('calcOvertime', () => {
  test('workday overtime', async () => {
    const result = await calcService.calcOvertime(2, 25, 'workday');
    expect(result).toBe(75);
  });

  test('weekend overtime', async () => {
    const result = await calcService.calcOvertime(8, 25, 'weekend');
    expect(result).toBe(400);
  });

  test('holiday overtime', async () => {
    const result = await calcService.calcOvertime(8, 25, 'holiday');
    expect(result).toBe(600);
  });
});

describe('calcSocialInsurance', () => {
  test('normal case', async () => {
    const result = await calcService.calcSocialInsurance(5000, '广东');
    expect(result.pension).toBe(400);
    expect(result.medical).toBe(100);
    expect(result.unemployment).toBe(25);
    expect(result.housing).toBe(600);
    expect(result.total).toBe(1125);
  });

  test('below minimum wage', async () => {
    const result = await calcService.calcSocialInsurance(2000, '广东');
    expect(result.baseSalary).toBe(2300);
  });
});

describe('calcCompensation', () => {
  test('full case with all items', async () => {
    const result = await calcService.calcCompensation({
      workYears: 3,
      monthlySalary: 5000,
      overtimeHours: 10,
      city: '广东',
      hasDoubleSalary: true,
      doubleSalaryMonths: 2,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.severance.amount).toBe(15000);
    expect(result.doubleSalary).toBe(10000);
  });
});
