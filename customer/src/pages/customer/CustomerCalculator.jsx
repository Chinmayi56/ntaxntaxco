
import { useCallback, useEffect, useState } from "react";

/* =========================================================
   Helpers
========================================================= */

const historyUserKey = "ntaxco_calculation_history";

const loadHistory = () => {
  try {
    const saved = localStorage.getItem(historyUserKey);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveHistory = (item) => {
  try {
    const history = loadHistory();
    const updated = [item, ...history].slice(0, 20);
    localStorage.setItem(historyUserKey, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
};

const formatDate = (date) => {
  try {
    return new Date(date).toLocaleString();
  } catch {
    return "";
  }
};

/* =========================================================
   Normal Calculator
========================================================= */

function NormalCalculator({ onCalculated }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);

  const input = useCallback(
    (value) => {
      if (fresh) {
        setDisplay(value === "." ? "0." : value);
        setFresh(false);
        return;
      }

      setDisplay((prev) => {
        if (value === "." && prev.includes(".")) {
          return prev;
        }

        if (prev === "0" && value !== ".") {
          return value;
        }

        return prev + value;
      });
    },
    [fresh]
  );

  const clear = useCallback(() => {
    setDisplay("0");
    setStored(null);
    setOp(null);
    setFresh(true);
  }, []);

  const back = useCallback(() => {
    setDisplay((prev) => {
      if (prev.length <= 1) {
        return "0";
      }

      return prev.slice(0, -1);
    });
  }, []);

  const calculate = useCallback((a, b, operator) => {
    switch (operator) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  }, []);

  const choose = useCallback(
    (operator) => {
      const current = Number(display);

      if (!Number.isFinite(current)) {
        return;
      }

      if (stored !== null && op) {
        const result = calculate(stored, current, op);

        if (!Number.isFinite(result)) {
          setDisplay("Error");
          setStored(null);
          setOp(null);
          setFresh(true);
          return;
        }

        setDisplay(String(result));
        setStored(result);
      } else {
        setStored(current);
      }

      setOp(operator);
      setFresh(true);
    },
    [display, stored, op, calculate]
  );

  const equal = useCallback(() => {
    if (stored === null || !op) {
      return;
    }

    const current = Number(display);

    if (!Number.isFinite(current)) {
      return;
    }

    const result = calculate(stored, current, op);

    if (!Number.isFinite(result)) {
      setDisplay("Error");
      setStored(null);
      setOp(null);
      setFresh(true);
      return;
    }

    const expression = `${stored} ${op} ${current}`;

    setDisplay(String(result));
    setStored(null);
    setOp(null);
    setFresh(true);

    const historyItem = {
      id: Date.now(),
      type: "Normal Calculator",
      expression,
      result,
      createdAt: new Date().toISOString(),
    };

    saveHistory(historyItem);

    if (onCalculated) {
      onCalculated(historyItem);
    }
  }, [display, stored, op, calculate, onCalculated]);

  const percent = useCallback(() => {
    const current = Number(display);

    if (!Number.isFinite(current)) {
      return;
    }

    const result = current / 100;

    setDisplay(String(result));
    setFresh(true);
  }, [display]);

  const press = useCallback(
    (key) => {
      if (/^[0-9]$/.test(key) || key === ".") {
        input(key);
        return;
      }

      if (["+", "-", "×", "÷"].includes(key)) {
        choose(key);
        return;
      }

      if (key === "=") {
        equal();
        return;
      }

      if (key === "%") {
        percent();
        return;
      }

      if (key === "AC") {
        clear();
        return;
      }

      if (key === "⌫") {
        back();
      }
    },
    [input, choose, equal, percent, clear, back]
  );

  useEffect(() => {
    const onKey = (event) => {
      const keyMap = {
        Enter: "=",
        Escape: "AC",
        Backspace: "⌫",
        "/": "÷",
        "*": "×",
      };

      const key = keyMap[event.key] || event.key;

      const allowedKeys = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        ".",
        "%",
        "+",
        "-",
        "÷",
        "×",
        "=",
        "AC",
        "⌫",
      ];

      if (!allowedKeys.includes(key)) {
        return;
      }

      event.preventDefault();
      press(key);
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [press]);

  const keys = [
    "AC",
    "⌫",
    "%",
    "÷",
    "7",
    "8",
    "9",
    "×",
    "4",
    "5",
    "6",
    "-",
    "1",
    "2",
    "3",
    "+",
    "0",
    ".",
    "=",
  ];

  return (
    <div className="calculator-card">
      <div className="calculator-display">
        {display}
      </div>

      <div className="calculator-keys">
        {keys.map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => press(key)}
            className={`calculator-key ${
              ["+", "-", "×", "÷", "="].includes(key)
                ? "operator"
                : ""
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   GST Calculator
========================================================= */

function GstCalculator({ onCalculated }) {
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("18");

  const calculate = () => {
    const base = Number(amount);
    const gstRate = Number(rate);

    if (!Number.isFinite(base) || !Number.isFinite(gstRate)) {
      return;
    }

    const gst = (base * gstRate) / 100;
    const total = base + gst;

    const item = {
      id: Date.now(),
      type: "GST Calculator",
      expression: `${base} + ${gstRate}% GST`,
      result: total,
      details: {
        amount: base,
        gstRate,
        gst,
        total,
      },
      createdAt: new Date().toISOString(),
    };

    saveHistory(item);

    if (onCalculated) {
      onCalculated(item);
    }
  };

  return (
    <div className="calculator-form">
      <h3>GST Calculator</h3>

      <input
        type="number"
        placeholder="Enter amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />

      <input
        type="number"
        placeholder="GST rate %"
        value={rate}
        onChange={(event) => setRate(event.target.value)}
      />

      <button type="button" onClick={calculate}>
        Calculate GST
      </button>
    </div>
  );
}

/* =========================================================
   Income Tax Calculator
========================================================= */

function IncomeTaxCalculator({ onCalculated }) {
  const [income, setIncome] = useState("");
  const [tax, setTax] = useState(null);

  const calculate = () => {
    const annualIncome = Number(income);

    if (!Number.isFinite(annualIncome) || annualIncome < 0) {
      return;
    }

    let calculatedTax = 0;

    if (annualIncome > 1500000) {
      calculatedTax = (annualIncome - 1500000) * 0.3 + 187500;
    } else if (annualIncome > 1200000) {
      calculatedTax = (annualIncome - 1200000) * 0.2 + 127500;
    } else if (annualIncome > 900000) {
      calculatedTax = (annualIncome - 900000) * 0.15 + 82500;
    } else if (annualIncome > 600000) {
      calculatedTax = (annualIncome - 600000) * 0.1 + 37500;
    } else if (annualIncome > 300000) {
      calculatedTax = (annualIncome - 300000) * 0.05;
    }

    setTax(calculatedTax);

    const item = {
      id: Date.now(),
      type: "Income Tax Calculator",
      expression: `Income: ${annualIncome}`,
      result: calculatedTax,
      createdAt: new Date().toISOString(),
    };

    saveHistory(item);

    if (onCalculated) {
      onCalculated(item);
    }
  };

  return (
    <div className="calculator-form">
      <h3>Income Tax Calculator</h3>

      <input
        type="number"
        placeholder="Annual income"
        value={income}
        onChange={(event) => setIncome(event.target.value)}
      />

      <button type="button" onClick={calculate}>
        Calculate Tax
      </button>

      {tax !== null && (
        <div className="calculator-result">
          Estimated Tax: ₹{tax.toFixed(2)}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   TDS Calculator
========================================================= */

function TdsCalculator({ onCalculated }) {
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("10");
  const [tds, setTds] = useState(null);

  const calculate = () => {
    const base = Number(amount);
    const tdsRate = Number(rate);

    if (!Number.isFinite(base) || !Number.isFinite(tdsRate)) {
      return;
    }

    const result = (base * tdsRate) / 100;

    setTds(result);

    const item = {
      id: Date.now(),
      type: "TDS Calculator",
      expression: `${base} × ${tdsRate}%`,
      result,
      createdAt: new Date().toISOString(),
    };

    saveHistory(item);

    if (onCalculated) {
      onCalculated(item);
    }
  };

  return (
    <div className="calculator-form">
      <h3>TDS Calculator</h3>

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />

      <input
        type="number"
        placeholder="TDS rate %"
        value={rate}
        onChange={(event) => setRate(event.target.value)}
      />

      <button type="button" onClick={calculate}>
        Calculate TDS
      </button>

      {tds !== null && (
        <div className="calculator-result">
          TDS: ₹{tds.toFixed(2)}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   EMI Calculator
========================================================= */

function EmiCalculator({ onCalculated }) {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");
  const [emi, setEmi] = useState(null);

  const calculate = () => {
    const p = Number(principal);
    const annualRate = Number(rate);
    const n = Number(months);

    if (
      !Number.isFinite(p) ||
      !Number.isFinite(annualRate) ||
      !Number.isFinite(n) ||
      p <= 0 ||
      n <= 0
    ) {
      return;
    }

    const monthlyRate = annualRate / 12 / 100;

    let result;

    if (monthlyRate === 0) {
      result = p / n;
    } else {
      result =
        (p *
          monthlyRate *
          Math.pow(1 + monthlyRate, n)) /
        (Math.pow(1 + monthlyRate, n) - 1);
    }

    setEmi(result);

    const item = {
      id: Date.now(),
      type: "EMI Calculator",
      expression: `Principal: ${p}, Rate: ${annualRate}%, Months: ${n}`,
      result,
      createdAt: new Date().toISOString(),
    };

    saveHistory(item);

    if (onCalculated) {
      onCalculated(item);
    }
  };

  return (
    <div className="calculator-form">
      <h3>EMI Calculator</h3>

      <input
        type="number"
        placeholder="Loan amount"
        value={principal}
        onChange={(event) => setPrincipal(event.target.value)}
      />

      <input
        type="number"
        placeholder="Annual interest rate %"
        value={rate}
        onChange={(event) => setRate(event.target.value)}
      />

      <input
        type="number"
        placeholder="Loan period in months"
        value={months}
        onChange={(event) => setMonths(event.target.value)}
      />

      <button type="button" onClick={calculate}>
        Calculate EMI
      </button>

      {emi !== null && (
        <div className="calculator-result">
          Monthly EMI: ₹{emi.toFixed(2)}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Recent Calculations
========================================================= */

function RecentCalculations({ history, onClear }) {
  return (
    <div className="recent-calculations">
      <div className="recent-header">
        <h3>Recent Calculations</h3>

        {history.length > 0 && (
          <button type="button" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p>No recent calculations.</p>
      ) : (
        history.map((item) => (
          <div className="recent-item" key={item.id}>
            <div>
              <strong>{item.type}</strong>
              <div>{item.expression}</div>
            </div>

            <div>
              <strong>
                {typeof item.result === "number"
                  ? item.result.toFixed(2)
                  : item.result}
              </strong>
              <small>{formatDate(item.createdAt)}</small>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* =========================================================
   Customer Calculator
========================================================= */
/* =========================================================
   Customer Calculator - Page Layout
========================================================= */

export default function CustomerCalculator() {
  const [activeTab, setActiveTab] = useState("normal");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleCalculated = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(historyUserKey);
    } catch {
      // Ignore localStorage errors
    }

    setHistory([]);
  }, []);

  const calculatorTabs = [
    {
      id: "normal",
      title: "Normal Calculator",
      shortTitle: "Calculator",
    },
    {
      id: "gst",
      title: "GST Calculator",
      shortTitle: "GST",
    },
    {
      id: "income-tax",
      title: "Income Tax",
      shortTitle: "Income Tax",
    },
    {
      id: "tds",
      title: "TDS",
      shortTitle: "TDS",
    },
    {
      id: "emi",
      title: "EMI",
      shortTitle: "EMI",
    },
  ];

  return (
    <div className="customer-calculator-page">

      {/* Page Header */}
      <div className="calculator-page-header">
        <div>
          <span className="calculator-page-label">
            FINANCIAL TOOLS
          </span>

          <h1>Calculator</h1>

          <p>
            Quickly calculate GST, income tax, TDS, EMI and more.
          </p>
        </div>
      </div>

      {/* Main Calculator Area */}
      <div className="calculator-main-card">

        {/* Calculator Tabs */}
        <div className="calculator-tabs-wrapper">

          <div className="calculator-tabs">

            {calculatorTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={
                  activeTab === tab.id ? "active" : ""
                }
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="calculator-tab-desktop">
                  {tab.title}
                </span>

                <span className="calculator-tab-mobile">
                  {tab.shortTitle}
                </span>
              </button>
            ))}

          </div>

        </div>

        {/* Calculator Content */}
        <div className="calculator-content">

          {activeTab === "normal" && (
            <NormalCalculator
              onCalculated={handleCalculated}
            />
          )}

          {activeTab === "gst" && (
            <GstCalculator
              onCalculated={handleCalculated}
            />
          )}

          {activeTab === "income-tax" && (
            <IncomeTaxCalculator
              onCalculated={handleCalculated}
            />
          )}

          {activeTab === "tds" && (
            <TdsCalculator
              onCalculated={handleCalculated}
            />
          )}

          {activeTab === "emi" && (
            <EmiCalculator
              onCalculated={handleCalculated}
            />
          )}

        </div>

      </div>

      {/* Recent Calculations */}
      <div className="calculator-history-card">

        <RecentCalculations
          history={history}
          onClear={clearHistory}
        />

      </div>

    </div>
  );
}
