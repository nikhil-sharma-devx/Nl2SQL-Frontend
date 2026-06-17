import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table } from 'lucide-react';

interface DataChartProps {
  data: any[];
  config: {
    type: string;
    x_axis: string;
    y_axis: string;
  };
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  color: 'var(--foreground)',
};

const DataChart: React.FC<DataChartProps> = ({ data, config }) => {
  const [activeType, setActiveType] = useState<string>('table');

  useEffect(() => {
    if (config && config.type && config.type !== 'none') {
      setActiveType(config.type.toLowerCase());
    } else {
      setActiveType('table');
    }
  }, [config]);

  if (!data || data.length === 0) {
    return null;
  }

  const keys = Object.keys(data[0]);
  const xAxisKey = config.x_axis || keys.find(k => typeof data[0][k] === 'string' || k.toLowerCase().includes('name') || k.toLowerCase().includes('date') || k.toLowerCase().includes('id')) || keys[0] || '';
  const yAxisKey = config.y_axis || keys.find(k => typeof data[0][k] === 'number' || k.toLowerCase().includes('amount') || k.toLowerCase().includes('price') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('count')) || keys.find(k => !isNaN(Number(data[0][k]))) || keys[1] || '';

  const formattedData = data.map((row) => ({
    ...row,
    [yAxisKey]: Number(row[yAxisKey]) || 0,
  }));

  const renderTable = () => {
    return (
      <div className="max-h-[260px] overflow-auto rounded-lg border border-border bg-background/40 custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur-md">
              {keys.map((h) => (
                <th key={h} className="p-2.5 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                {keys.map((h) => (
                  <td key={h} className="p-2.5 font-medium text-foreground/80">{String(row[h])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    switch (activeType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey={xAxisKey} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--primary)' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey={yAxisKey} fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey={xAxisKey} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={yAxisKey} stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--chart-2)' }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: '11px' }} />
              <Pie data={formattedData} dataKey={yAxisKey} nameKey={xAxisKey} cx="50%" cy="47%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                {formattedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      case 'table':
      default:
        return renderTable();
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card/40 p-4 shadow-sm backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-violet-text" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visualization</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background/50 p-0.5">
          <button
            onClick={() => setActiveType('bar')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'bar' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Bar Chart"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveType('line')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'line' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Line Chart"
          >
            <LineChartIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveType('pie')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'pie' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Pie Chart"
          >
            <PieChartIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveType('table')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Raw Table"
          >
            <Table className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {renderChart()}
    </div>
  );
};

export default DataChart;
