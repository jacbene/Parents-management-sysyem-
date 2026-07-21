import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Grade, Student } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Award, Users, Filter, BarChart2, Check, TrendingUp, Sparkles, HelpCircle, GraduationCap } from 'lucide-react';

interface ClassroomViewD3Props {
  allGrades: Grade[];
  allStudents: Student[];
  activeStudent: Student | null;
  language: string;
}

export default function ClassroomViewD3({
  allGrades = [],
  allStudents = [],
  activeStudent,
  language = 'fr'
}: ClassroomViewD3Props) {
  const isFr = language === 'fr';

  // State selectors
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [chartType, setChartType] = useState<'histogram' | 'scatter'>('scatter');
  
  // Dimensions state for responsiveness
  const [dimensions, setDimensions] = useState({ width: 600, height: 350 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Initialize selected classroom based on active student
  useEffect(() => {
    if (activeStudent && activeStudent.classRoom) {
      setSelectedClass(activeStudent.classRoom);
    } else if (allStudents.length > 0) {
      const classes = Array.from(new Set(allStudents.map(s => s.classRoom).filter(Boolean)));
      if (classes.length > 0) {
        setSelectedClass(classes[0]);
      }
    }
  }, [activeStudent, allStudents]);

  // Unique lists for selectors
  const classrooms = Array.from(new Set(allStudents.map(s => s.classRoom).filter(Boolean))).sort();
  const subjects = ['all', ...Array.from(new Set(allGrades.map(g => g.subject).filter(Boolean))).sort()];

  // Helper to categorize grades into terms (Trimestres)
  const getGradeTerm = (dateStr: string): string => {
    if (!dateStr) return '1';
    const date = new Date(dateStr);
    const month = date.getMonth(); // 0 = Jan, 11 = Dec
    if (month >= 8 && month <= 11) return '1'; // Sept - Dec
    if (month >= 0 && month <= 2) return '2';  // Jan - Mar
    return '3';                                // Apr - Jun (and others)
  };

  // Resize listener using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 320),
          height: 350
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // --- FILTER AND CALCULATE DATASET ---
  // 1. Students in this class
  const classStudents = allStudents.filter(s => s.classRoom === selectedClass);
  const studentIds = new Set(classStudents.map(s => s.id));

  // 2. Grades for these students
  const classGrades = allGrades.filter(g => studentIds.has(g.studentId));

  // 3. Filter class grades by term and subject
  const filteredGrades = classGrades.filter(g => {
    // Term filter
    if (selectedTerm !== 'all') {
      if (getGradeTerm(g.date) !== selectedTerm) return false;
    }
    // Subject filter
    if (selectedSubject !== 'all') {
      if (g.subject !== selectedSubject) return false;
    }
    return true;
  });

  // 4. Compute student averages based on filtered grades
  const studentData = classStudents.map(student => {
    const studentGrades = filteredGrades.filter(g => g.studentId === student.id);
    if (studentGrades.length === 0) {
      return {
        student,
        average: null,
        count: 0
      };
    }
    const totalNormalized = studentGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0);
    const average = totalNormalized / studentGrades.length;
    return {
      student,
      average,
      count: studentGrades.length
    };
  })
  .filter(d => d.average !== null) as Array<{ student: Student; average: number; count: number }>;

  // Sort student data from lowest to highest average for distribution curve
  const sortedStudents = [...studentData].sort((a, b) => a.average - b.average);

  // --- STATISTICS ---
  const classSize = classStudents.length;
  const gradedSize = studentData.length;
  const classAvg = gradedSize > 0 
    ? studentData.reduce((sum, s) => sum + s.average, 0) / gradedSize 
    : 0;
  const highestAvg = gradedSize > 0 
    ? Math.max(...studentData.map(s => s.average)) 
    : 0;
  const passingCount = studentData.filter(s => s.average >= 10).length;
  const successRate = gradedSize > 0 
    ? (passingCount / gradedSize) * 100 
    : 0;

  // --- D3 RENDERING CODE ---
  useEffect(() => {
    if (!svgRef.current || gradedSize === 0) return;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 45 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    // Create central drawing group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Define standard gradients for beautiful styling
    const defs = svg.append('defs');

    // Soft Indigo gradient for active elements
    const activeGrad = defs.append('linearGradient')
      .attr('id', 'active-gradient')
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%');
    activeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#4f46e5');
    activeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#818cf8');

    // Success Teal gradient
    const successGrad = defs.append('linearGradient')
      .attr('id', 'success-gradient')
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%');
    successGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981');
    successGrad.append('stop').attr('offset', '100%').attr('stop-color', '#34d399');

    // Warning Amber gradient
    const warnGrad = defs.append('linearGradient')
      .attr('id', 'warning-gradient')
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%');
    warnGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b');
    warnGrad.append('stop').attr('offset', '100%').attr('stop-color', '#fbbf24');

    // Danger Red gradient
    const dangerGrad = defs.append('linearGradient')
      .attr('id', 'danger-gradient')
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%');
    dangerGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444');
    dangerGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f87171');

    // Setup scales
    const yScale = d3.scaleLinear()
      .domain([0, 20])
      .range([chartHeight, 0]);

    // Create Tooltip group (hidden by default)
    const tooltip = svg.append('g')
      .attr('class', 'tooltip')
      .style('display', 'none');

    tooltip.append('rect')
      .attr('width', 180)
      .attr('height', 65)
      .attr('fill', '#1e293b') // slate-800
      .attr('rx', 8)
      .attr('opacity', 0.95)
      .attr('stroke', '#475569')
      .attr('stroke-width', 1.5);

    const tooltipName = tooltip.append('text')
      .attr('x', 12)
      .attr('y', 20)
      .attr('fill', '#f8fafc')
      .attr('font-size', '11px')
      .attr('font-weight', '700');

    const tooltipAvg = tooltip.append('text')
      .attr('x', 12)
      .attr('y', 38)
      .attr('fill', '#38bdf8') // sky-400
      .attr('font-size', '10px')
      .attr('font-weight', '600');

    const tooltipRank = tooltip.append('text')
      .attr('x', 12)
      .attr('y', 52)
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-weight', '500');

    // --- RENDER SCATTER DOT PLOT ---
    if (chartType === 'scatter') {
      const xScale = d3.scaleLinear()
        .domain([0, sortedStudents.length - 1])
        .range([20, chartWidth - 20]);

      // Gridlines
      g.append('g')
        .attr('class', 'grid-lines')
        .attr('stroke', '#e2e8f0')
        .attr('opacity', 0.6)
        .selectAll('line')
        .data([10, 12, 14, 16])
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', d => yScale(d))
        .attr('y2', d => yScale(d))
        .attr('stroke-dasharray', '3,3');

      // Add Passing threshold reference line (10/20)
      g.append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', yScale(10))
        .attr('y2', yScale(10))
        .attr('stroke', '#f87171')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,2');

      g.append('text')
        .attr('x', 5)
        .attr('y', yScale(10) - 4)
        .attr('fill', '#ef4444')
        .attr('font-size', '8.5px')
        .attr('font-weight', 'bold')
        .text(isFr ? 'Seuil d\'admission (10/20)' : 'Passing Threshold (10/20)');

      // Class Average reference line
      g.append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', yScale(classAvg))
        .attr('y2', yScale(classAvg))
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 2);

      g.append('text')
        .attr('x', chartWidth - 5)
        .attr('y', yScale(classAvg) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#4f46e5')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .text(`${isFr ? 'Moyenne classe' : 'Class average'}: ${classAvg.toFixed(2)}/20`);

      // Axes
      const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}/20`);
      g.append('g')
        .call(yAxis)
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-size', '9px')
        .attr('color', '#64748b')
        .selectAll('.domain').remove();

      // Custom X-axis representation: Rank ordering
      const xAxisGroup = g.append('g')
        .attr('transform', `translate(0, ${chartHeight})`);
      
      xAxisGroup.append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', '#cbd5e1');

      // X-axis label
      xAxisGroup.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .text(isFr ? 'Élèves ordonnés par rang de performance (Ascendant)' : 'Students sorted by performance rank (Ascending)');

      // Draw horizontal reference level text boxes
      const refLevels = [
        { val: 16, label: isFr ? 'Très Bien' : 'Excellent', color: '#059669' },
        { val: 12, label: isFr ? 'Assez Bien' : 'Good', color: '#2563eb' }
      ];
      refLevels.forEach(ref => {
        g.append('text')
          .attr('x', chartWidth - 5)
          .attr('y', yScale(ref.val) - 4)
          .attr('text-anchor', 'end')
          .attr('fill', ref.color)
          .attr('font-size', '8px')
          .attr('font-weight', '600')
          .attr('opacity', 0.8)
          .text(ref.label);
      });

      // Interactive Guidelines (vertical and horizontal hover lines)
      const hoverLineX = g.append('line')
        .attr('stroke', '#64748b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .style('display', 'none');

      const hoverLineY = g.append('line')
        .attr('stroke', '#64748b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .style('display', 'none');

      // Draw student dots
      g.selectAll('.student-dot')
        .data(sortedStudents)
        .enter()
        .append('circle')
        .attr('class', 'student-dot')
        .attr('cx', (d, i) => xScale(i))
        .attr('cy', d => yScale(d.average))
        .attr('r', d => {
          const isActive = activeStudent && d.student.id === activeStudent.id;
          return isActive ? 8 : 6;
        })
        .attr('fill', d => {
          if (d.average >= 16) return 'url(#success-gradient)';
          if (d.average >= 12) return 'url(#active-gradient)';
          if (d.average >= 10) return 'url(#warning-gradient)';
          return 'url(#danger-gradient)';
        })
        .attr('stroke', d => {
          const isActive = activeStudent && d.student.id === activeStudent.id;
          return isActive ? '#1e293b' : '#ffffff';
        })
        .attr('stroke-width', d => {
          const isActive = activeStudent && d.student.id === activeStudent.id;
          return isActive ? 2.5 : 1.5;
        })
        .style('cursor', 'pointer')
        .attr('opacity', 0)
        // Entry transition
        .transition()
        .duration(600)
        .delay((d, i) => i * 30)
        .attr('opacity', 1)
        .attr('cy', d => yScale(d.average));

      // Visual pulse ring for active selected student
      if (activeStudent) {
        const activeIndex = sortedStudents.findIndex(d => d.student.id === activeStudent.id);
        if (activeIndex !== -1) {
          const act = sortedStudents[activeIndex];
          
          const pulseRing = g.append('circle')
            .attr('cx', xScale(activeIndex))
            .attr('cy', yScale(act.average))
            .attr('r', 13)
            .attr('fill', 'none')
            .attr('stroke', '#6366f1')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.8);

          // Animate the pulse ring
          const repeatPulse = () => {
            pulseRing
              .attr('r', 10)
              .attr('opacity', 0.8)
              .transition()
              .duration(1200)
              .attr('r', 20)
              .attr('opacity', 0)
              .on('end', repeatPulse);
          };
          repeatPulse();

          // Write active student's label explicitly
          g.append('text')
            .attr('x', xScale(activeIndex))
            .attr('y', yScale(act.average) - 16)
            .attr('text-anchor', 'middle')
            .attr('fill', '#1e293b')
            .attr('font-weight', '800')
            .attr('font-size', '8.5px')
            .attr('class', 'active-student-label')
            .text(`${act.student.name} (${isFr ? 'Moi' : 'Me'})`);
        }
      }

      // Re-attach hover behavior manually to allow transitions to coexist
      g.selectAll('.student-dot')
        .on('mouseover', function(event, d: any) {
          const dataNode = d as ArrayElement<typeof sortedStudents>;
          const idx = sortedStudents.findIndex(s => s.student.id === dataNode.student.id);
          const cx = xScale(idx);
          const cy = yScale(dataNode.average);

          // Enlarge dot
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 10);

          // Show guidelines
          hoverLineX
            .attr('x1', cx)
            .attr('x2', cx)
            .attr('y1', cy)
            .attr('y2', chartHeight)
            .style('display', 'block');

          hoverLineY
            .attr('x1', 0)
            .attr('x2', cx)
            .attr('y1', cy)
            .attr('y2', cy)
            .style('display', 'block');

          // Tooltip details
          const rankNum = sortedStudents.length - idx;
          const suffix = rankNum === 1 ? 'er' : 'e';
          const rankText = isFr 
            ? `Rang: ${rankNum}${suffix} / ${sortedStudents.length}`
            : `Rank: ${rankNum} of ${sortedStudents.length}`;

          const mention = dataNode.average >= 16 ? (isFr ? 'Très Bien' : 'Excellent')
                        : dataNode.average >= 14 ? (isFr ? 'Bien' : 'Very Good')
                        : dataNode.average >= 12 ? (isFr ? 'Assez Bien' : 'Good')
                        : dataNode.average >= 10 ? (isFr ? 'Passable' : 'Fair')
                        : (isFr ? 'Insuffisant' : 'Weak');

          tooltipName.text(dataNode.student.name);
          tooltipAvg.text(`${isFr ? 'Moyenne' : 'Average'}: ${dataNode.average.toFixed(2)}/20 (${mention})`);
          tooltipRank.text(`${rankText} • ${dataNode.count} éval.`);

          // Adjust tooltip position to prevent clipping
          let tx = cx + margin.left + 15;
          let ty = cy + margin.top - 30;
          if (tx + 190 > dimensions.width) {
            tx = cx + margin.left - 195;
          }
          if (ty < 0) {
            ty = 10;
          }

          tooltip
            .attr('transform', `translate(${tx}, ${ty})`)
            .style('display', 'block');
        })
        .on('mouseout', function(event, d) {
          const dataNode = d as any;
          const isActive = activeStudent && dataNode.student.id === activeStudent.id;

          // Restore dot size
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', isActive ? 8 : 6);

          // Hide guidelines & tooltip
          hoverLineX.style('display', 'none');
          hoverLineY.style('display', 'none');
          tooltip.style('display', 'none');
        });
    }

    // --- RENDER FREQUENCY HISTOGRAM ---
    if (chartType === 'histogram') {
      // Define beautiful Cameroon-aligned brackets
      const binsData = [
        { label: isFr ? 'Insuffisant (<10)' : 'Weak (<10)', min: 0, max: 10, count: 0, color: 'url(#danger-gradient)' },
        { label: isFr ? 'Passable (10-12)' : 'Fair (10-12)', min: 10, max: 12, count: 0, color: 'url(#warning-gradient)' },
        { label: isFr ? 'Assez Bien (12-14)' : 'Good (12-14)', min: 12, max: 14, count: 0, color: 'url(#active-gradient)' },
        { label: isFr ? 'Bien (14-16)' : 'Very Good (14-16)', min: 14, max: 16, count: 0, color: 'url(#active-gradient)' },
        { label: isFr ? 'Excellent (16-20)' : 'Excellent (16-20)', min: 16, max: 20.1, count: 0, color: 'url(#success-gradient)' }
      ];

      // Populating bin counts
      sortedStudents.forEach(d => {
        const val = d.average;
        for (let bin of binsData) {
          if (val >= bin.min && val < bin.max) {
            bin.count++;
            break;
          }
        }
      });

      const xScale = d3.scaleBand()
        .domain(binsData.map(b => b.label))
        .range([0, chartWidth])
        .padding(0.25);

      const maxBinCount = d3.max(binsData, b => b.count) || 1;
      const yHistScale = d3.scaleLinear()
        .domain([0, Math.max(maxBinCount + 1, 4)])
        .range([chartHeight, 0])
        .nice();

      // Axes
      const yAxis = d3.axisLeft(yHistScale).ticks(Math.min(maxBinCount + 1, 8)).tickFormat(d3.format('d'));
      g.append('g')
        .call(yAxis)
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-size', '9px')
        .attr('color', '#64748b')
        .selectAll('.domain').remove();

      const xAxis = d3.axisBottom(xScale);
      const xAxisGroup = g.append('g')
        .attr('transform', `translate(0, ${chartHeight})`)
        .call(xAxis);

      xAxisGroup.attr('font-family', 'Inter, sans-serif')
        .attr('font-size', '8px')
        .attr('color', '#64748b');

      xAxisGroup.selectAll('.domain').attr('stroke', '#cbd5e1');

      // Gridlines
      g.append('g')
        .attr('class', 'grid-lines')
        .attr('stroke', '#f1f5f9')
        .selectAll('line')
        .data(yHistScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', d => yHistScale(d))
        .attr('y2', d => yHistScale(d));

      // Draw Bars
      g.selectAll('.bar')
        .data(binsData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', b => xScale(b.label) || 0)
        .attr('y', chartHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', b => b.color)
        .attr('rx', 4)
        .style('cursor', 'pointer')
        // Hover reactions
        .on('mouseover', function(event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 0.85);

          // Dynamic tooltip inside SVG
          const cx = (xScale(d.label) || 0) + xScale.bandwidth() / 2;
          const cy = yHistScale(d.count);

          tooltipName.text(d.label);
          tooltipAvg.text(`${isFr ? 'Effectif' : 'Count'}: ${d.count} ${isFr ? 'Élève(s)' : 'Student(s)'}`);
          tooltipRank.text(`${isFr ? 'Pourcentage' : 'Percentage'}: ${((d.count / gradedSize) * 100).toFixed(1)}%`);

          let tx = cx + margin.left - 90;
          let ty = cy + margin.top - 75;
          if (ty < 0) ty = 10;

          tooltip
            .attr('transform', `translate(${tx}, ${ty})`)
            .style('display', 'block');
        })
        .on('mouseout', function() {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 1);

          tooltip.style('display', 'none');
        })
        // Entry transition
        .transition()
        .duration(650)
        .delay((d, i) => i * 50)
        .attr('y', b => yHistScale(b.count))
        .attr('height', b => chartHeight - yHistScale(b.count));

      // Draw values over bars
      g.selectAll('.bar-label')
        .data(binsData)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', b => (xScale(b.label) || 0) + xScale.bandwidth() / 2)
        .attr('y', chartHeight)
        .attr('text-anchor', 'middle')
        .attr('fill', '#475569')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('opacity', 0)
        .text(b => b.count > 0 ? b.count : '')
        .transition()
        .duration(650)
        .delay((d, i) => i * 50)
        .attr('y', b => yHistScale(b.count) - 6)
        .attr('opacity', 1);
    }

  }, [sortedStudents, dimensions, chartType, activeStudent, language, gradedSize, classAvg, isFr]);

  type ArrayElement<ArrayType extends readonly unknown[]> = 
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

  return (
    <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs flex flex-col gap-6" id="classroom-d3-dashboard">
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              {isFr ? 'Tableau d\'Analyse Collective de la Classe' : 'Classroom View Analytics'}
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            {isFr 
              ? 'Analyse statistique de la répartition des performances pour un trimestre ou une matière donnée.'
              : 'Statistical overview of performance distribution for a specific term and subject.'}
          </p>
        </div>

        {/* Chart Type Selector Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start gap-1">
          <button
            onClick={() => setChartType('scatter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              chartType === 'scatter'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {isFr ? 'Courbe de Rang' : 'Rank Curve'}
          </button>
          <button
            onClick={() => setChartType('histogram')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              chartType === 'histogram'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            {isFr ? 'Histogramme' : 'Histogram'}
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
        
        {/* Classroom Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
            <Users className="h-3 w-3" />
            {isFr ? 'Salle de classe' : 'Classroom'}
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
          >
            {classrooms.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        {/* Subject Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {isFr ? 'Matière / Discipline' : 'Subject'}
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
          >
            {subjects.map(subj => (
              <option key={subj} value={subj}>
                {subj === 'all' 
                  ? (isFr ? 'Toutes les matières' : 'All subjects') 
                  : subj}
              </option>
            ))}
          </select>
        </div>

        {/* Term Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
            <Filter className="h-3 w-3" />
            {isFr ? 'Période / Trimestre' : 'Period / Term'}
          </label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">{isFr ? 'Année complète' : 'Full year'}</option>
            <option value="1">{isFr ? 'Trimestre 1 (Sept - Déc)' : 'Term 1 (Sept - Dec)'}</option>
            <option value="2">{isFr ? 'Trimestre 2 (Jan - Mars)' : 'Term 2 (Jan - Mar)'}</option>
            <option value="3">{isFr ? 'Trimestre 3 (Avr - Juin)' : 'Term 3 (Apr - Jun)'}</option>
          </select>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Class Size Card */}
        <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {isFr ? 'Taille de la classe' : 'Class Size'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-xl font-black text-slate-800">{classSize}</span>
            <span className="text-xs font-semibold text-slate-500">
              {isFr ? 'élèves' : 'students'}
            </span>
          </div>
          <span className="text-[9px] text-slate-400 mt-1">
            {isFr 
              ? `${gradedSize} élève(s) avec notes` 
              : `${gradedSize} active student(s)`}
          </span>
        </div>

        {/* Class Average Card */}
        <div className="bg-indigo-50/30 rounded-xl p-3.5 border border-indigo-50 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-indigo-600/80 tracking-wider">
            {isFr ? 'Moyenne générale' : 'Class Average'}
          </span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-indigo-700">
              {gradedSize > 0 ? classAvg.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-bold text-indigo-500">/20</span>
          </div>
          <span className="text-[9px] text-indigo-500 mt-1">
            {gradedSize > 0 
              ? (isFr ? 'Niveau global de la classe' : 'Overall collective average') 
              : (isFr ? 'Aucune note' : 'No grades')}
          </span>
        </div>

        {/* Success Rate Card */}
        <div className="bg-emerald-50/30 rounded-xl p-3.5 border border-emerald-50/50 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
            {isFr ? 'Taux de réussite' : 'Success Rate'}
          </span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-emerald-700">
              {gradedSize > 0 ? `${successRate.toFixed(1)}%` : '--'}
            </span>
          </div>
          <span className="text-[9px] text-emerald-500 mt-1">
            {isFr 
              ? `${passingCount} sur ${gradedSize} élève(s) >= 10` 
              : `${passingCount} of ${gradedSize} student(s) >= 10`}
          </span>
        </div>

        {/* Highest Average Card */}
        <div className="bg-amber-50/20 rounded-xl p-3.5 border border-amber-100/40 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">
            {isFr ? 'Moyenne la plus haute' : 'Highest Grade'}
          </span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-black text-amber-700">
              {gradedSize > 0 ? highestAvg.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-bold text-amber-500">/20</span>
          </div>
          <span className="text-[9px] text-amber-500/80 mt-1">
            {isFr ? 'Meilleure performance' : 'Top student average'}
          </span>
        </div>
      </div>

      {/* D3 Canvas container */}
      <div className="relative border border-slate-100 rounded-2xl bg-slate-50/20 p-4 min-h-[360px]" ref={containerRef}>
        {gradedSize === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-3">
            <HelpCircle className="h-10 w-10 text-slate-300" />
            <div>
              <p className="text-sm font-bold text-slate-700">
                {isFr ? 'Aucune note disponible' : 'No Grades Found'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                {isFr 
                  ? 'Il n\'y a aucune note enregistrée correspondant à ces filtres dans notre base de données.'
                  : 'There are no graded assessments recorded matching this classroom, subject or term.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="overflow-visible select-none"
            />
          </div>
        )}
      </div>

      {/* Footer Diagnostic Insight Note */}
      {gradedSize > 0 && (
        <div className="bg-indigo-50/25 p-3.5 rounded-xl border border-indigo-50 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
          <div className="text-[11px] leading-relaxed text-slate-600">
            {isFr ? (
              <span>
                <strong>Conseil pédagogique :</strong>{' '}
                {chartType === 'scatter' 
                  ? 'Survolez chaque cercle de la courbe pour identifier les performances individuelles. L\'écart par rapport à la ligne médiane violette indique la dispersion de la classe.'
                  : 'L\'histogramme montre la répartition par mentions. Une répartition saine présente une courbe en cloche (Gaussienne) centrée autour de la mention "Assez Bien" (12-14).'}
              </span>
            ) : (
              <span>
                <strong>Pedagogical tip:</strong>{' '}
                {chartType === 'scatter'
                  ? 'Hover over each circle on the curve to inspect individual student grades. Distance from the purple median class line displays the class dispersion.'
                  : 'The histogram groups students by official performance brackets. A typical healthy classroom distribution follows a bell-curve centered around "Good" (12-14).'}
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
