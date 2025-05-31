// List of names to search for (fixed 4 options)
const names = [
  'Romanovas Marijus',
  'Vilčinskas Rimantas',
  'Ričkus Arnoldas',
  'Rutkauskas Robertas',
  'Dauderienė Živilė',
];

function selectRowsWithNames(selectedNames) {
  // Get all tables on the page
  const tables = document.querySelectorAll('table');
  tables.forEach((table) => {
    // Get all rows in the table
    const rows = Array.from(table.querySelectorAll('tr'));
    const rowsToRemove = [];
    rows.forEach((row) => {
      // Check if any cell in the row contains one of the names
      const cells = Array.from(row.querySelectorAll('td'));
      // Only check data rows (skip header rows with no td)
      if (cells.length === 0) return;
      const found = cells.some((cell) =>
        selectedNames.some((name) =>
          cell.textContent
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .includes(name.normalize('NFD').replace(/\p{Diacritic}/gu, ''))
        )
      );
      if (found) {
        row.classList.add('selected'); // Add a class for highlighting
      } else {
        row.classList.remove('selected');
        rowsToRemove.push(row);
      }
    });
    // Remove rows after iteration
    rowsToRemove.forEach((row) => row.remove());
  });
}

function highlightFastestTimes() {
  const tables = document.querySelectorAll('table');
  tables.forEach((table) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return;
    const maxCols = Math.max(
      ...rows.map((row) => row.querySelectorAll('td').length)
    );

    // --- Add column numbers above the table ---
    // Remove old col-numbers row if present
    const oldColNumbers = table.querySelector('tr.col-numbers');
    if (oldColNumbers) oldColNumbers.remove();

    // Find the header row (thead > tr or first tr)
    let headerRow =
      table.querySelector('thead tr') || table.querySelector('tr');
    if (headerRow) {
      const colNumbersRow = document.createElement('tr');
      colNumbersRow.className = 'col-numbers';
      // Add empty th for row numbers or name columns
      for (let col = 0; col < maxCols; col++) {
        const th = document.createElement('th');
        // Start numbering from the first column where we color code (col >= 3)
        if (col >= 3) {
          th.textContent = (col - 2).toString();
          th.style.background = '#e0e0e0';
          th.style.fontWeight = 'bold';
        } else {
          th.textContent = '';
        }
        colNumbersRow.appendChild(th);
      }
      // Insert colNumbersRow after the headerRow
      if (headerRow.nextSibling) {
        headerRow.parentNode.insertBefore(colNumbersRow, headerRow.nextSibling);
      } else {
        headerRow.parentNode.appendChild(colNumbersRow);
      }
    }

    for (let col = 2; col < maxCols; col++) {
      // Skip columns where any cell contains 'Laikas' or if this is the name column (col === 1) or the column immediately after the name (col === 2)
      if (col === 1 || col === 2) continue;
      let skipColumn = rows.some((row) => {
        const cells = row.querySelectorAll('td');
        const cell = cells[col];
        return cell && cell.textContent.includes('Laikas');
      });
      if (skipColumn) continue;

      // Prepare arrays for color coding and ranking
      let cellsWithSegmentTimes = [];
      let cellsWithTotalTimes = [];

      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        const cell = cells[col];
        if (!cell) return;
        let html = cell.innerHTML;

        // --- Segment time for color coding (after <br>) ---
        let afterBr = html.split(/<br\s*\/?>(.*)/i)[1] || '';
        let segmentMatch = afterBr.match(/(\d+):(\d+)/);
        let segmentSec = null;
        if (segmentMatch) {
          let min = parseInt(segmentMatch[1], 10);
          let sec = parseInt(segmentMatch[2], 10);
          segmentSec = min * 60 + sec;
        }

        // --- Total time for ranking (before <br>) ---
        let beforeBr = html.split(/<br\s*\/?>/i)[0] || '';
        let totalMatch = beforeBr.match(/(\d+):(\d+)/);
        let totalSec = null;
        if (totalMatch) {
          let min = parseInt(totalMatch[1], 10);
          let sec = parseInt(totalMatch[2], 10);
          totalSec = min * 60 + sec;
        }

        if (segmentSec !== null) {
          cellsWithSegmentTimes.push({ cell, segmentSec });
        }
        if (totalSec !== null) {
          cellsWithTotalTimes.push({ cell, totalSec });
        }
      });

      // Color coding by segment time
      if (cellsWithSegmentTimes.length > 0) {
        cellsWithSegmentTimes.sort((a, b) => a.segmentSec - b.segmentSec);
        const colors = [
          '#b6fcb6', // green
          '#fffcb6', // yellow
          '#ffd59e', // orange
          '#ffb6b6', // red
        ];
        let rank = 0,
          lastTime = null,
          colorIdx = 0,
          actualRank = 1;
        for (
          let i = 0;
          i < cellsWithSegmentTimes.length && colorIdx < colors.length;
          i++
        ) {
          const { cell, segmentSec } = cellsWithSegmentTimes[i];
          if (lastTime === null || segmentSec > lastTime) {
            rank = actualRank;
            colorIdx = rank - 1;
          }
          if (colorIdx < colors.length) {
            cell.style.backgroundColor = colors[colorIdx];
          }
          lastTime = segmentSec;
          actualRank++;
        }
      }

      // Ranking digit by total time (before <br>), insert as third line
      if (cellsWithTotalTimes.length > 0) {
        cellsWithTotalTimes.sort((a, b) => a.totalSec - b.totalSec);
        let rank = 0,
          lastTime = null,
          actualRank = 1;
        for (let i = 0; i < cellsWithTotalTimes.length; i++) {
          const { cell, totalSec } = cellsWithTotalTimes[i];
          if (lastTime === null || totalSec > lastTime) {
            rank = actualRank;
          }
          // Insert rank digit as third line (after two <br>), but do not add new line if already present
          let html = cell.innerHTML;
          // Find all <br> tags
          let brMatches = [...html.matchAll(/<br\s*\/?>/gi)];
          if (brMatches.length >= 2) {
            // Find where the third line starts
            let insertIdx = html.indexOf('>', brMatches[1].index) + 1;
            // Check if third line already has content (not empty or just whitespace)
            let afterSecondBr = html.slice(insertIdx).trim();
            // If third line is empty, insert the rank digit as a new line
            if (
              !afterSecondBr ||
              afterSecondBr === '' ||
              afterSecondBr === '<br>'
            ) {
              cell.innerHTML =
                html.slice(0, insertIdx) +
                `<br /><span style='font-weight:bold;color:#333'>${rank}</span>` +
                html.slice(insertIdx);
            }
            // If third line already has content, do not add a new line, but append rank digit at the end of third line
            else {
              // Find end of third line (next <br> or end of string)
              let nextBr = afterSecondBr.indexOf('<br');
              if (nextBr !== -1) {
                let before = html.slice(0, insertIdx + nextBr);
                let after = html.slice(insertIdx + nextBr);
                cell.innerHTML =
                  before +
                  ` <span style='font-weight:bold;color:#333'>${rank}</span>` +
                  after;
              } else {
                cell.innerHTML =
                  html +
                  ` <span style='font-weight:bold;color:#333'>${rank}</span>`;
              }
            }
          } else {
            // fallback: append at end as a new line
            cell.innerHTML =
              html +
              `<br /><span style='font-weight:bold;color:#333'>${rank}</span>`;
          }
          lastTime = totalSec;
          actualRank++;
        }
      }
    }
  });
}

function addLegendToTop() {
  // Remove existing legend if present
  const oldLegend = document.getElementById('legend');
  if (oldLegend) oldLegend.remove();

  // Create legend container
  const legend = document.createElement('div');
  legend.id = 'legend';
  legend.style.maxWidth = '80vw';
  legend.style.margin = '1em auto 2em auto';

  legend.innerHTML = `
    <h3>Paaiškinimas</h3>
    <ul>
      <li>
        <span style="background:#b6fcb6;padding:0 0.5em;">&nbsp;</span>
        – greičiausias atkarpos laikas (žalia)
      </li>
      <li>
        <span style="background:#fffcb6;padding:0 0.5em;">&nbsp;</span>
        – antras greičiausias atkarpos laikas (geltona)
      </li>
      <li>
        <span style="background:#ffd59e;padding:0 0.5em;">&nbsp;</span>
        – trečias greičiausias atkarpos laikas (oranžinė)
      </li>
      <li>
        <span style="background:#ffb6b6;padding:0 0.5em;">&nbsp;</span>
        – ketvirtas greičiausias atkarpos laikas (raudona)
      </li>
      <li>
        <b>Skaičius trečioje eilutėje langelyje</b> – bendro laiko reitingas tame etape (1 – greičiausias bendras laikas ir t.t.)
      </li>
    </ul>
  `;

  // Insert legend at the top of the body
  document.body.insertBefore(legend, document.body.firstChild);
}

function addSecondTableLegend() {
  // Remove existing legend if present
  const oldLegend = document.getElementById('legend-second');
  if (oldLegend) oldLegend.remove();

  // Create legend container
  const legend = document.createElement('div');
  legend.id = 'legend-second';
  legend.style.maxWidth = '80vw';
  legend.style.margin = '1em auto 2em auto';

  legend.innerHTML = `
    <h3>Paaiškinimas (antra lentelė)</h3>
    <ul>
      <li>
        <span style="background:#4be04b;padding:0 0.5em;">&nbsp;</span>
        – Segmento vietos nuokrypis yra teigiamas nuo bendrai užimtos vietos (žalia)
      </li>
      <li>
        <span style="background:#fffcb6;padding:0 0.5em;">&nbsp;</span>
        – Segmento vietos nuokrypis yra ±10% nuo bendrai užimtos vietos (geltona)
      </li>
      <li>
        <span style="background:#ff4b4b;padding:0 0.5em;">&nbsp;</span>
        – Segmento vietos nuokrypis yra neigiamas nuo bendrai užimtos vietos (raudona)
      </li>
    </ul>
  `;

  // Insert after the first table (and its legend)
  const sbContent = document.getElementById('sbContent');
  const tables = sbContent ? sbContent.querySelectorAll('table') : [];
  if (tables.length > 0) {
    const firstTable = tables[0];
    // Find the first legend after the first table
    let nextElem = firstTable.nextSibling;
    while (nextElem && nextElem.nodeType === 3) nextElem = nextElem.nextSibling; // skip text nodes
    if (nextElem && nextElem.id === 'legend') {
      // Insert after the first legend
      nextElem.parentNode.insertBefore(legend, nextElem.nextSibling);
    } else {
      // Insert after the first table
      firstTable.parentNode.insertBefore(legend, firstTable.nextSibling);
    }
  } else {
    document.body.appendChild(legend);
  }
}

function showFilteredTableCopy() {
  // Find the first visible table (with filtered rows)
  const originalTable = document.querySelector('#sbContent table');
  if (!originalTable) return;

  // Clone only the visible rows (those with class 'selected')
  const filteredRows = Array.from(
    originalTable.querySelectorAll('tr.selected')
  );
  if (filteredRows.length === 0) return;

  // Create a new table element
  const copyTable = document.createElement('table');
  copyTable.style.margin = '2em auto';

  // Optionally, copy thead if present
  const thead = originalTable.querySelector('thead');
  if (thead) {
    copyTable.appendChild(thead.cloneNode(true));
  }

  // Add column numbers row (same logic as in highlightFastestTimes)
  const maxCols = Math.max(
    ...filteredRows.map((row) => row.querySelectorAll('td').length)
  );
  const colNumbersRow = document.createElement('tr');
  colNumbersRow.className = 'col-numbers';
  for (let col = 0; col < maxCols; col++) {
    const th = document.createElement('th');
    if (col >= 3) {
      th.textContent = (col - 2).toString();
      th.style.background = '#e0e0e0';
      th.style.fontWeight = 'bold';
    } else {
      th.textContent = '';
    }
    colNumbersRow.appendChild(th);
  }
  // Insert colNumbersRow after thead or as first row if no thead
  if (copyTable.tHead && copyTable.tHead.rows.length > 0) {
    copyTable.tHead.appendChild(colNumbersRow);
  } else {
    const tbodyForColNumbers = document.createElement('tbody');
    tbodyForColNumbers.appendChild(colNumbersRow);
    copyTable.appendChild(tbodyForColNumbers);
  }

  // Create tbody and append filtered rows
  const tbody = document.createElement('tbody');
  filteredRows.forEach((row) => {
    const newRow = row.cloneNode(true);

    // Get the reference value from the first td of the row (e.g. 47 for Marijus Romanovas)
    const refTd = row.querySelector('td');
    let refVal = null;
    if (refTd) {
      const refMatch = refTd.textContent.match(/\d+/);
      if (refMatch) {
        refVal = parseInt(refMatch[0], 10);
      }
    }

    // Remove rating digit (span with font-weight:bold) from each td in this row
    const tds = newRow.querySelectorAll('td');
    tds.forEach((td, tdIdx) => {
      // Remove all bold rating digits (span with font-weight:bold)
      td.innerHTML = td.innerHTML.replace(
        /<span[^>]*font-weight:\s*bold;?[^>]*>.*?<\/span>/gi,
        ''
      );
    });

    // Color coding logic for each td in this row (skip first td)
    tds.forEach((td, tdIdx) => {
      if (tdIdx === 0) return; // skip first td (reference)
      const html = td.innerHTML;
      const lines = html.split(/<br\s*\/?>/i);

      if (lines.length >= 2 && refVal !== null && refVal !== 0) {
        // Find number in brackets in second line
        const secondMatch = lines[1].match(/\(\s*(\d+)\s*\)/); // <-- updated regex

        if (secondMatch) {
          const secondVal = parseInt(secondMatch[1], 10);

          const diff = secondVal - refVal;
          const percent = (diff / refVal) * 100;

          // Gradual color coding
          function lerpColor(a, b, t) {
            const ah = a.match(/\w\w/g).map((x) => parseInt(x, 16));
            const bh = b.match(/\w\w/g).map((x) => parseInt(x, 16));
            const rh = ah.map((av, i) => Math.round(av + (bh[i] - av) * t));
            return `#${rh
              .map((x) => x.toString(16).padStart(2, '0'))
              .join('')}`;
          }

          let color = '#fffcb6'; // yellow
          const maxPercent = 50; // cap at +/-50% for full green/red

          if (Math.abs(percent) <= 10) {
            color = '#fffcb6'; // yellow
          } else if (percent > 10) {
            // from yellow to strong red (#ff4b4b)
            let t = Math.min((percent - 10) / (maxPercent - 10), 1);
            color = lerpColor('fffcb6', 'ff4b4b', t);
          } else if (percent < -10) {
            // from yellow to strong green (#4be04b)
            let t = Math.min((-percent - 10) / (maxPercent - 10), 1);
            color = lerpColor('fffcb6', '4be04b', t);
          }
          td.style.backgroundColor = color;
        }
      }
    });

    tbody.appendChild(newRow);
  });
  copyTable.appendChild(tbody);

  // Insert the copy inside #sbContent, after the original table
  const sbContent = document.getElementById('sbContent');
  if (sbContent && originalTable.parentNode === sbContent) {
    sbContent.insertBefore(copyTable, originalTable.nextSibling);
  } else {
    document.body.appendChild(copyTable);
  }

  // --- ADD CHARTS FOR EACH PARTICIPANT BELOW THE TABLE ---
  // For each row (participant), extract digits in brackets from second line of each td (except first)
  filteredRows.forEach((row, rowIdx) => {
    const tds = row.querySelectorAll('td');
    if (tds.length < 2) return;
    const name = tds[1].textContent.trim();

    // Collect values and count how many data columns (skip first three tds)
    const values = [];
    for (let i = 3; i < tds.length; i++) {
      const html = tds[i].innerHTML;
      const lines = html.split(/<br\s*\/?>/i);
      if (lines.length >= 2) {
        // Remove all non-digit, non-parenthesis characters and then match
        const cleaned = lines[1]
          .replace(/&nbsp;|[\u00A0]/g, ' ')
          .replace(/\s+/g, ' ');
        const match = cleaned.match(/\(\s*(\d+)\s*\)/);
        if (match) values.push(Number(match[1]));
        else values.push(null);
      } else {
        values.push(null);
      }
    }

    // If there are fewer than the expected number of segments, pad with nulls
    // (for example, if you expect 18 segments, pad to length 18)
    const expectedSegments = maxCols - 3; // maxCols is defined above for the table
    while (values.length < expectedSegments) {
      values.push(null);
    }

    // Create x axis labels starting from 1
    const xLabels = values.map((_, i) => (i + 1).toString());

    // Create a canvas for the chart
    const canvas = document.createElement('canvas');
    canvas.width = 800; // Make chart wider
    canvas.height = 220; // Keep y axis visibly higher

    canvas.style.display = 'block';
    canvas.style.margin = '0.5em auto 2em auto';

    // Add a label above the chart
    const label = document.createElement('div');
    label.textContent = `Grafikas: ${name}`;
    label.style.textAlign = 'center';
    label.style.fontWeight = 'bold';
    label.style.marginTop = '1em';

    // Insert after the table
    copyTable.parentNode.insertBefore(label, copyTable.nextSibling);
    copyTable.parentNode.insertBefore(canvas, label.nextSibling);

    // Draw the chart using Chart.js
    const chartPlugins = [];
    if (window.ChartDataLabels) chartPlugins.push(window.ChartDataLabels);

    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: xLabels,
        datasets: [
          {
            label: 'Skaičius skliaustuose (2 eil.)',
            data: values,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            pointBackgroundColor: '#1976d2',
            pointRadius: 4,
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function (context) {
                // Show "KP: X, Vieta: Y" in tooltip
                return context.parsed.y !== null
                  ? `KP: ${context.label}, Vieta: ${context.parsed.y}`
                  : `KP: ${context.label}, Nėra duomenų`;
              },
            },
          },
          datalabels: window.ChartDataLabels
            ? {
                display: true,
                color: '#222',
                align: 'top',
                font: { weight: 'bold' },
                formatter: function (value, context) {
                  // Show "Vieta: X" above each point
                  return value !== null ? `P${value}` : '';
                },
              }
            : undefined,
        },
        scales: {
          x: { title: { display: true, text: 'KP' } },
          y: {
            title: { display: true, text: 'Vieta' },
            beginAtZero: true,
            suggestedMax:
              Math.max(...values.filter((v) => v !== null)) + 5 || 20,
            reverse: true, // <-- add this line to invert the y-axis
          },
        },
      },
      plugins: chartPlugins,
    });
  });
}

// --- Main update function ---
function updateFilteredData() {
  // Restore original table if needed (optional: reload or keep a backup)
  window.location.reload(); // simplest way for now
}

// --- On DOMContentLoaded, use only the fixed names array ---
window.addEventListener('DOMContentLoaded', () => {
  selectRowsWithNames(names);
  highlightFastestTimes();
  addLegendToTop();
  showFilteredTableCopy();
  addSecondTableLegend();

  // Add chart explanation below tables but above charts
  const chartExplanation = document.createElement('div');
  chartExplanation.id = 'chart-explanation';
  chartExplanation.style.maxWidth = '80vw';
  chartExplanation.style.margin = '2em auto 1em auto';
  chartExplanation.style.padding = '1em';
  chartExplanation.style.background = '#e3f2fd';
  chartExplanation.style.borderRadius = '8px';
  chartExplanation.innerHTML = `
    <h3>Grafikų paaiškinimas</h3>
    <ul>
      <li>Ašyje "KP" – atkarpos numeris, o "Vieta" – užimta vieta atkarpoje </li>
      <li>Skaičius virš kiekvieno taško grafike rodo vietą tame KP.</li>
    </ul>
  `;

  // Insert chart explanation after the second table (filtered table)
  setTimeout(() => {
    const sbContent = document.getElementById('sbContent');
    const tables = sbContent ? sbContent.querySelectorAll('table') : [];
    let filteredTable = null;
    if (tables.length > 1) {
      filteredTable = tables[1];
    } else {
      // fallback: find the last table on the page
      const allTables = document.querySelectorAll('table');
      filteredTable = allTables[allTables.length - 1];
    }
    if (filteredTable) {
      filteredTable.parentNode.insertBefore(
        chartExplanation,
        filteredTable.nextSibling
      );
    } else {
      document.body.appendChild(chartExplanation);
    }
  }, 0);
});
