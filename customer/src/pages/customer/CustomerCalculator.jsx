```jsx
import { useCallback, useEffect, useState } from "react";
import {
  Calculator as CalcIcon,
  Percent,
  IndianRupee,
  ReceiptIndianRupee,
  Landmark,
  Clock3,
  Trash2,
  RotateCcw,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";
import { inr } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const HISTORY_KEY = "ntaxco_customer_calculation_history_v1";
const MAX_HISTORY = 20;
const DEFAULT_TDS_RATE = "10";

function historyUserKey(user) {
  return String(user?.id || user?.email || "unknown-customer");
}

function loadHistory(user) {
  try {
    const raw = localStorage.getItem(
      `${HISTORY_KEY}:${historyUserKey(user)}`
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function NormalCalculator({ onCalculated, restore }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (restore?.result?.value !== undefined) {
      setDisplay(String(restore.result.value));
      setStored(null);
      setOp(null);
      setFresh(true);
    }
  }, [restore]);

  const input = useCallback(
    (v) => {
      if (fresh) {
        setDisplay(v);
        setFresh(false);
      } else {
        setDisplay((current) =>
          current === "0" ? v : current + v
        );
      }
    },
    [fresh]
  );

  const clear = useCallback(() => {
    setDisplay("0");
    setStored(null);
    setOp(null);
    setFresh(false);
  }, []);

  const back = useCallback(() => {
    setDisplay((current) =>
      current.length > 1 ? current.slice(0, -1) : "0"
    );
  }, []);

  const choose = useCallback(
    (next) => {
      const value = Number(display);

      if (!Number.isFinite(value)) {
        return;
      }

      setStored(value);
      setOp(next);
      setFresh(true);
    },
    [display]
  );

  const equal = useCallback(() => {
    if (stored === null || !op) {
      return;
    }

    const b = Number(display);

    let r =
      op === "+"
        ? stored + b
        : op === "-"
        ? stored - b
        : op === "×"
        ? stored * b
        : op === "÷"
        ? b === 0
          ? NaN
          : stored / b
        : stored;

    if (!Number.isFinite(r)) {
      setDisplay("Error");
      setStored(null);
      setOp(null);
      setFresh(true);
      toast.error("Unable to calculate that expression.");
      return;
    }

    const expression = `${stored} ${op} ${b}`;
    const value = Number(r.toFixed(10));

    setDisplay(String(value));
    setStored(null);
    setOp(null);
    setFresh(true);

    onCalculated?.({
      type: "Normal",
      summary: `${expression} = ${value}`,
      inputs: {
        expression,
      },
      result: {
        value,
      },
    });
  }, [display, stored, op, onCalculated]);

  const percent = useCallback(() => {
    const value = Number(display);

    if (!Number.isFinite(value)) {
      return;
    }

    const result = Number((value / 100).toFixed(10));

    setDisplay(String(result));

    onCalculated?.({
      type: "Normal",
      summary: `${value}% = ${result}`,
      inputs: {
        expression: `${value}%`,
      },
      result: {
        value: result,
      },
    });
  }, [display, onCalculated]);

  const press = useCallback(
    (k) => {
      if (k === "=") {
        equal();
      } else if (k === "%") {
        percent();
      } else if (["÷", "×", "+", "-"].includes(k)) {
        choose(k);
      } else {
        input(k);
      }
    },
    [equal, percent, choose, input]
  );

  useEffect(() => {
    const onKey = (e) => {
      const map = {
        Enter: "=",
        Escape: "AC",
        Backspace: "⌫",
        "/": "÷",
        "*": "×",
      };

      const k = map[e.key] || e.key;

      if (
        [
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
        ].includes(k)
      ) {
        e.preventDefault();

        if (k === "AC") {
          clear();
        } else if (k === "⌫") {
          back();
        } else {
          press(k);
        }
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [clear, back, press]);

  const keys = [
    "7",
    "8",
    "9",
    "÷",
    "4",
    "5",
    "6",
    "×",
    "1",
    "2",
    "3",
    "-",
    "0",
    ".",
    "%",
    "+",
    "(",
    ")",
    "=",
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 max-w-md">
      <div className="rounded-xl bg-zinc-900 text-white text-right text-3xl font-mono p-5 mb-4 overflow-x-auto">
        {display}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Button variant="outline" onClick={clear}>
          AC
        </Button>

        <Button variant="outline" onClick={back}>
          ⌫
        </Button>

        <Button variant="outline" onClick={percent}>
          %
        </Button>

        <Button onClick={() => choose("÷")}>÷</Button>

        {keys
          .filter((k) => !["(", ")"].includes(k))
          .map((k) => (
            <Button
              key={k}
              variant={
                ["÷", "×", "-", "+", "="].includes(k)
                  ? "default"
                  : "outline"
              }
              className="h-12"
              onClick={() => press(k)}
            >
              {k}
            </Button>
          ))}
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Keyboard: 0–9, +, -, *, /, %, Enter, Backspace, Escape.
      </p>
    </div>
  );
}

function GstCalculator({ onCalculated, restore }) {
  const [amount, setAmount] = useState(
    restore?.inputs?.amount ?? ""
  );
  const [rate, setRate] = useState(
    restore?.inputs?.rate ?? "18"
  );
  const [customRate, setCustomRate] = useState(
    restore?.inputs?.customRate ?? ""
  );
  const [mode, setMode] = useState(
    restore?.inputs?.mode ?? "exclusive"
  );
  const [interstate, setInterstate] = useState(
    restore?.inputs?.interstate ?? false
  );
  const [result, setResult] = useState(
    restore?.result ?? null
  );
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    const numericAmount = Number(amount);
    const numericRate = Number(
      rate === "custom" ? customRate : rate
    );

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      toast.error("Please enter a valid amount.");
      return;
    }

    if (
      !Number.isFinite(numericRate) ||
      numericRate < 0 ||
      numericRate > 100
    ) {
      toast.error("Please enter a valid GST rate.");
      return;
    }

    setLoading(true);

    try {
      const r = await api.post("/calculators/gst", {
        amount: numericAmount,
        rate: numericRate,
        mode,
        interstate,
      });

      const data = r.data.data;

      setResult(data);

      onCalculated?.({
        type: "GST",
        summary: `${inr(numericAmount)} → ${inr(
          data.final_amount
        )}`,
        inputs: {
          amount,
          rate,
          customRate,
          mode,
          interstate,
        },
        result: data,
      });
    } catch (e) {
      toast.error(
        describeApiError(e, "Unable to calculate GST")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Amount (₹)</Label>
          <Input
            className="mt-1.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
          />
        </div>

        <div>
          <Label>GST Rate</Label>

          <select
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          >
            {["5", "12", "18", "28"].map((x) => (
              <option key={x} value={x}>
                {x}%
              </option>
            ))}

            <option value="custom">Custom</option>
          </select>

          {rate === "custom" && (
            <Input
              className="mt-2"
              type="number"
              min="0"
              max="100"
              placeholder="Custom %"
              value={customRate}
              onChange={(e) =>
                setCustomRate(e.target.value)
              }
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          variant={
            mode === "exclusive" ? "default" : "outline"
          }
          onClick={() => setMode("exclusive")}
        >
          GST Exclusive
        </Button>

        <Button
          variant={
            mode === "inclusive" ? "default" : "outline"
          }
          onClick={() => setMode("inclusive")}
        >
          GST Inclusive
        </Button>

        <Button
          variant={interstate ? "default" : "outline"}
          onClick={() => setInterstate(!interstate)}
        >
          {interstate ? "IGST" : "CGST + SGST"}
        </Button>
      </div>

      <Button
        className="mt-4 bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
        onClick={calculate}
        disabled={loading}
      >
        Calculate
      </Button>

      {result && (
        <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
          {[
            ["Base Amount", result.base_amount],
            ["GST Amount", result.gst_amount],
            ["CGST", result.cgst],
            ["SGST", result.sgst],
            ["IGST", result.igst],
            ["Final Amount", result.final_amount],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg bg-zinc-50 border p-3 flex justify-between"
            >
              <span>{label}</span>
              <strong>{inr(value)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncomeTaxCalculator({ onCalculated, restore }) {
  const [form, setForm] = useState({
    annual_income:
      restore?.inputs?.annual_income ?? "",
    deductions:
      restore?.inputs?.deductions ?? "0",
    other_income:
      restore?.inputs?.other_income ?? "0",
    regime:
      restore?.inputs?.regime ?? "new",
  });

  const [result, setResult] = useState(
    restore?.result ?? null
  );
  const [loading, setLoading] = useState(false);

  const set = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const calculate = async () => {
    const annual = Number(form.annual_income);
    const deductions = Number(form.deductions);
    const other = Number(form.other_income);

    if (!Number.isFinite(annual) || annual < 0) {
      toast.error("Please enter a valid annual income.");
      return;
    }

    if (
      !Number.isFinite(deductions) ||
      deductions < 0 ||
      !Number.isFinite(other) ||
      other < 0
    ) {
      toast.error(
        "Please enter valid income/deduction values."
      );
      return;
    }

    setLoading(true);

    try {
      const r = await api.post(
        "/calculators/income-tax",
        {
          ...form,
          annual_income: annual,
          deductions,
          other_income: other,
        }
      );

      const data = r.data.data;

      setResult(data);

      onCalculated?.({
        type: "Income Tax",
        summary: `${inr(annual)} estimated income`,
        inputs: form,
        result: data,
      });
    } catch (e) {
      toast.error(
        describeApiError(
          e,
          "Unable to calculate income tax"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Annual Income (₹)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            value={form.annual_income}
            onChange={(e) =>
              set("annual_income", e.target.value)
            }
          />
        </div>

        <div>
          <Label>Other Income (₹)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            value={form.other_income}
            onChange={(e) =>
              set("other_income", e.target.value)
            }
          />
        </div>

        <div>
          <Label>Deductions (₹)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            value={form.deductions}
            onChange={(e) =>
              set("deductions", e.target.value)
            }
          />
        </div>

        <div>
          <Label>Tax Regime</Label>

          <select
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3"
            value={form.regime}
            onChange={(e) =>
              set("regime", e.target.value)
            }
          >
            <option value="new">
              New Regime — AY 2026-27
            </option>
            <option value="old">
              Old Regime — AY 2026-27
            </option>
          </select>
        </div>
      </div>

      <Button
        className="mt-4 bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
        onClick={calculate}
        disabled={loading}
      >
        Calculate
      </Button>

      {result && (
        <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
          {[
            ["Gross Income", result.gross_income],
            ["Deductions", result.deductions],
            ["Taxable Income", result.taxable_income],
            ["Income Tax", result.income_tax],
            [
              "Health & Education Cess",
              result.cess,
            ],
            ["Estimated Tax", result.estimated_tax],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg bg-zinc-50 border p-3 flex justify-between"
            >
              <span>{label}</span>
              <strong>{inr(value)}</strong>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-500 mt-4">
        Estimate only. Tax liability can depend on taxpayer
        type, special-rate income, exemptions, surcharge,
        marginal relief and other applicable rules.
      </p>
    </div>
  );
}

function TdsCalculator({ onCalculated, restore }) {
  const [amount, setAmount] = useState(
    restore?.inputs?.amount ?? ""
  );
  const [rate, setRate] = useState(
    restore?.inputs?.rate ?? DEFAULT_TDS_RATE
  );
  const [description, setDescription] = useState(
    restore?.inputs?.description ?? ""
  );
  const [result, setResult] = useState(
    restore?.result ?? null
  );

  const calculate = () => {
    const gross = Number(amount);
    const tdsRate = Number(rate);

    if (!Number.isFinite(gross) || gross < 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    if (
      !Number.isFinite(tdsRate) ||
      tdsRate < 0 ||
      tdsRate > 100
    ) {
      toast.error("Please enter a valid TDS rate.");
      return;
    }

    const tds = (gross * tdsRate) / 100;
    const net = gross - tds;

    const data = {
      gross_amount: gross,
      tds_rate: tdsRate,
      tds_amount: tds,
      net_amount: net,
    };

    setResult(data);

    onCalculated?.({
      type: "TDS",
      summary: `${inr(gross)} → ${inr(tds)} TDS`,
      inputs: {
        amount,
        rate,
        description,
      },
      result: data,
    });
  };

  const reset = () => {
    setAmount("");
    setRate(DEFAULT_TDS_RATE);
    setDescription("");
    setResult(null);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Amount (₹)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value)
            }
            placeholder="1,00,000"
          />
        </div>

        <div>
          <Label>TDS Rate (%)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rate}
            onChange={(e) =>
              setRate(e.target.value)
            }
            placeholder="10"
          />
        </div>

        <div className="sm:col-span-2">
          <Label>
            Description / Purpose (optional)
          </Label>
          <Input
            className="mt-1.5"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            placeholder="e.g. Professional fees"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
          onClick={calculate}
        >
          Calculate
        </Button>

        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Reset
        </Button>
      </div>

      {result && (
        <div className="mt-5">
          <h3 className="font-semibold text-[#0A2540] mb-3">
            TDS Summary
          </h3>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              ["Gross Amount", result.gross_amount],
              [
                "TDS Rate",
                `${result.tds_rate}%`,
              ],
              [
                "TDS Deducted",
                result.tds_amount,
              ],
              [
                "Net Payable",
                result.net_amount,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-zinc-50 border p-3 flex justify-between"
              >
                <span>{label}</span>
                <strong>
                  {typeof value === "number"
                    ? inr(value)
                    : value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500 mt-4">
        Estimate only. Applicable TDS rates depend on the
        transaction, payee and applicable tax rules. Verify
        the rate/category before making a deduction.
      </p>
    </div>
  );
}

function EmiCalculator({ onCalculated, restore }) {
  const [amount, setAmount] = useState(
    restore?.inputs?.amount ?? ""
  );
  const [rate, setRate] = useState(
    restore?.inputs?.rate ?? DEFAULT_TDS_RATE
  );
  const [tenure, setTenure] = useState(
    restore?.inputs?.tenure ?? ""
  );
  const [unit, setUnit] = useState(
    restore?.inputs?.unit ?? "years"
  );
  const [result, setResult] = useState(
    restore?.result ?? null
  );

  const calculate = () => {
    const P = Number(amount);
    const annualRate = Number(rate);
    const tenureValue = Number(tenure);

    if (!Number.isFinite(P) || P <= 0) {
      toast.error("Please enter a valid loan amount.");
      return;
    }

    if (!Number.isFinite(annualRate) || annualRate < 0) {
      toast.error("Please enter a valid interest rate.");
      return;
    }

    if (
      !Number.isFinite(tenureValue) ||
      tenureValue <= 0
    ) {
      toast.error("Please enter a valid loan tenure.");
      return;
    }

    const n =
      unit === "years"
        ? Math.round(tenureValue * 12)
        : Math.round(tenureValue);

    if (n <= 0 || n > 1200) {
      toast.error("Please enter a valid loan tenure.");
      return;
    }

    const r = annualRate / 100 / 12;

    const emi =
      r === 0
        ? P / n
        : (P * r * Math.pow(1 + r, n)) /
          (Math.pow(1 + r, n) - 1);

    const totalAmount = emi * n;
    const totalInterest = totalAmount - P;

    if (
      ![emi, totalAmount, totalInterest].every(
        Number.isFinite
      )
    ) {
      toast.error(
        "The entered values are too large to calculate safely."
      );
      return;
    }

    const data = {
      loan_amount: P,
      annual_interest_rate: annualRate,
      tenure_months: n,
      monthly_emi: emi,
      total_interest: totalInterest,
      total_amount: totalAmount,
    };

    setResult(data);

    onCalculated?.({
      type: "EMI",
      summary: `${inr(P)} loan`,
      inputs: {
        amount,
        rate,
        tenure,
        unit,
      },
      result: data,
    });
  };

  const reset = () => {
    setAmount("");
    setRate(DEFAULT_TDS_RATE);
    setTenure("");
    setUnit("years");
    setResult(null);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Loan Amount (₹)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value)
            }
            placeholder="10,00,000"
          />
        </div>

        <div>
          <Label>Annual Interest Rate (%)</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) =>
              setRate(e.target.value)
            }
            placeholder="10"
          />
        </div>

        <div>
          <Label>Loan Tenure</Label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            step="1"
            value={tenure}
            onChange={(e) =>
              setTenure(e.target.value)
            }
            placeholder="5"
          />
        </div>

        <div>
          <Label>Tenure Unit</Label>
          <select
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3"
            value={unit}
            onChange={(e) =>
              setUnit(e.target.value)
            }
          >
            <option value="years">Years</option>
            <option value="months">Months</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
          onClick={calculate}
        >
          Calculate
        </Button>

        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Reset
        </Button>
      </div>

      {result && (
        <div className="mt-5">
          <h3 className="font-semibold text-[#0A2540] mb-3">
            EMI Summary
          </h3>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              ["Loan Amount", result.loan_amount],
              ["Monthly EMI", result.monthly_emi],
              ["Total Interest", result.total_interest],
              [
                "Total Amount Payable",
                result.total_amount,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-zinc-50 border p-3 flex justify-between"
              >
                <span>{label}</span>
                <strong>{inr(value)}</strong>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-500 mt-3">
            Calculated using the standard reducing-balance
            EMI formula. Values are estimates and may differ
            from lender charges or schedules.
          </p>
        </div>
      )}
    </div>
  );
}

function RecentCalculations({
  history,
  onClear,
  onOpen,
}) {
  return (
    <section className="mt-8 max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-[#0A2540]">
            Recent Calculations
          </h2>

          <p className="text-xs text-zinc-500 mt-1">
            Your recent calculator activity is stored only
            in this browser for this customer account.
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No recent calculations yet. Start using the
          calculators to see your recent calculations here.
        </div>
      ) : (
        <div className="grid gap-2">
          {history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item)}
              className="w-full text-left rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-lg bg-brand-light text-[#0A2540] flex items-center justify-center shrink-0">
                  {item.type === "GST" ? (
                    <Percent className="h-4 w-4" />
                  ) : item.type === "EMI" ? (
                    <Landmark className="h-4 w-4" />
                  ) : item.type === "TDS" ? (
                    <ReceiptIndianRupee className="h-4 w-4" />
                  ) : (
                    <IndianRupee className="h-4 w-4" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm text-[#0A2540]">
                    {item.type} Calculation
                  </span>

                  <span className="block text-sm text-zinc-700 mt-0.5 truncate">
                    {item.summary}
                  </span>

                  <span className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                    <Clock3 className="h-3 w-3" />
                    {formatDate(item.created_at)}
                  </span>
                </span>

                <span className="text-xs font-semibold text-[#1E3A8A]">
                  View
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CustomerCalculator() {
  const { user } = useAuth();

  const [history, setHistory] = useState(() =>
    loadHistory(user)
  );

  const [tab, setTab] = useState("normal");
  const [restore, setRestore] = useState(null);

  useEffect(() => {
    setHistory(loadHistory(user));
  }, [user]);

  const addHistory = (entry) => {
    const item = {
      ...entry,
      id: `calc-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      created_at: new Date().toISOString(),
    };

    setHistory((prev) => {
      const next = [item, ...prev].slice(
        0,
        MAX_HISTORY
      );

      try {
        localStorage.setItem(
          `${HISTORY_KEY}:${historyUserKey(user)}`,
          JSON.stringify(next)
        );
      } catch {
        // Ignore localStorage errors.
      }

      return next;
    });
  };

  const clearHistory = () => {
    try {
      localStorage.removeItem(
        `${HISTORY_KEY}:${historyUserKey(user)}`
      );
    } catch {
      // Ignore localStorage errors.
    }

    setHistory([]);
    toast.success("Calculation history cleared.");
  };

  const openHistory = (item) => {
    setTab(
      item.type === "GST"
        ? "gst"
        : item.type === "Income Tax"
        ? "income-tax"
        : item.type === "TDS"
        ? "tds"
        : item.type === "EMI"
        ? "emi"
        : "normal"
    );

    setRestore(item);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader
        title="Calculator"
        breadcrumb={["Customer", "Calculator"]}
        subtitle="Quick estimates for arithmetic, GST, income tax, TDS and EMI."
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setRestore(null);
        }}
      >
        <TabsList className="bg-zinc-100 mb-5 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="normal">
            <CalcIcon className="h-4 w-4 mr-1.5" />
            Normal
          </TabsTrigger>

          <TabsTrigger value="gst">
            <Percent className="h-4 w-4 mr-1.5" />
            GST
          </TabsTrigger>

          <TabsTrigger value="income-tax">
            <IndianRupee className="h-4 w-4 mr-1.5" />
            Income Tax
          </TabsTrigger>

          <TabsTrigger value="tds">
            <ReceiptIndianRupee className="h-4 w-4 mr-1.5" />
            TDS
          </TabsTrigger>

          <TabsTrigger value="emi">
            <Landmark className="h-4 w-4 mr-1.5" />
            EMI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="normal">
          <NormalCalculator
            onCalculated={addHistory}
            restore={
              restore?.type === "Normal"
                ? restore
                : null
            }
          />
        </TabsContent>

        <TabsContent value="gst">
          <GstCalculator
            onCalculated={addHistory}
            restore={
              restore?.type === "GST"
                ? restore
                : null
            }
          />
        </TabsContent>

        <TabsContent value="income-tax">
          <IncomeTaxCalculator
            onCalculated={addHistory}
            restore={
              restore?.type === "Income Tax"
                ? restore
                : null
            }
          />
        </TabsContent>

        <TabsContent value="tds">
          <TdsCalculator
            onCalculated={addHistory}
            restore={
              restore?.type === "TDS"
                ? restore
                : null
            }
          />
        </TabsContent>

        <TabsContent value="emi">
          <EmiCalculator
            onCalculated={addHistory}
            restore={
              restore?.type === "EMI"
                ? restore
                : null
            }
          />
        </TabsContent>
      </Tabs>

      <RecentCalculations
        history={history}
        onClear={clearHistory}
        onOpen={openHistory}
      />

      <p className="text-xs text-zinc-500 mt-5">
        Tax calculators are general-purpose estimates and
        not professional tax advice.
      </p>
    </div>
  );
}
```
