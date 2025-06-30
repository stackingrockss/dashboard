import { showSnack } from './utils.js';

export function calculateTrade() {
    const entry = parseFloat(document.getElementById('entry_price').value);
    const stop = parseFloat(document.getElementById('stop_loss').value);
    const target = parseFloat(document.getElementById('target_price').value);
    const shares = parseFloat(document.getElementById('shares').value);

    if (!entry || !stop || !target || !shares) {
        showSnack('Please fill all fields', 'error');
        return;
    }

    const riskPerShare = Math.abs(entry - stop);
    const rewardPerShare = Math.abs(target - entry);
    const totalRisk = riskPerShare * shares;
    const totalReward = rewardPerShare * shares;
    const riskRewardRatio = rewardPerShare / riskPerShare;

    document.getElementById('risk_per_share').textContent = `Risk per Share: $${riskPerShare.toFixed(2)}`;
    document.getElementById('total_risk').textContent = `Total Risk: $${totalRisk.toFixed(2)}`;
    document.getElementById('reward_per_share').textContent = `Reward per Share: $${rewardPerShare.toFixed(2)}`;
    document.getElementById('total_reward').textContent = `Total Reward: $${totalReward.toFixed(2)}`;
    document.getElementById('risk_reward_ratio').textContent = `Risk/Reward Ratio: ${riskRewardRatio.toFixed(2)}:1`;
}

export function calculateFutures() {
    const esContracts = parseFloat(document.getElementById('es_contracts').value) || 0;
    const esPoints = parseFloat(document.getElementById('es_points').value) || 0;
    const mesContracts = parseFloat(document.getElementById('mes_contracts').value) || 0;
    const mesPoints = parseFloat(document.getElementById('mes_points').value) || 0;
    const nqContracts = parseFloat(document.getElementById('nq_contracts').value) || 0;
    const nqPoints = parseFloat(document.getElementById('nq_points').value) || 0;
    const mnqContracts = parseFloat(document.getElementById('mnq_contracts').value) || 0;
    const mnqPoints = parseFloat(document.getElementById('mnq_points').value) || 0;

    const esValuePerPoint = 50;
    const mesValuePerPoint = 5;
    const nqValuePerPoint = 20;
    const mnqValuePerPoint = 2;
    const esMargin = 12000;
    const mesMargin = 1200;
    const nqMargin = 17000;
    const mnqMargin = 1700;

    const esResult = esContracts * esPoints * esValuePerPoint;
    const mesResult = mesContracts * mesPoints * mesValuePerPoint;
    const nqResult = nqContracts * nqPoints * nqValuePerPoint;
    const mnqResult = mnqContracts * mnqPoints * mnqValuePerPoint;

    document.getElementById('es_result').textContent = esContracts ? `ES Profit/Loss: $${esResult.toFixed(2)}` : '';
    document.getElementById('es_margin').textContent = esContracts ? `ES Margin: $${(esContracts * esMargin).toFixed(2)}` : '';
    document.getElementById('mes_result').textContent = mesContracts ? `MES Profit/Loss: $${mesResult.toFixed(2)}` : '';
    document.getElementById('mes_margin').textContent = mesContracts ? `MES Margin: $${(mesContracts * mesMargin).toFixed(2)}` : '';
    document.getElementById('nq_result').textContent = nqContracts ? `NQ Profit/Loss: $${nqResult.toFixed(2)}` : '';
    document.getElementById('nq_margin').textContent = nqContracts ? `NQ Margin: $${(nqContracts * nqMargin).toFixed(2)}` : '';
    document.getElementById('mnq_result').textContent = mnqContracts ? `MNQ Profit/Loss: $${mnqResult.toFixed(2)}` : '';
    document.getElementById('mnq_margin').textContent = mnqContracts ? `MNQ Margin: $${(mnqContracts * mnqMargin).toFixed(2)}` : '';

    const esPointTable = document.querySelector('#es_point_table tbody');
    const nqPointTable = document.querySelector('#nq_point_table tbody');
    esPointTable.innerHTML = '';
    nqPointTable.innerHTML = '';
    for (let points = 1; points <= 10; points++) {
        const esRow = document.createElement('tr');
        esRow.innerHTML = `<td>${points}</td><td>$${points * esValuePerPoint}</td><td>$${points * mesValuePerPoint}</td>`;
        esPointTable.appendChild(esRow);

        const nqRow = document.createElement('tr');
        nqRow.innerHTML = `<td>${points}</td><td>$${points * nqValuePerPoint}</td><td>$${points * mnqValuePerPoint}</td>`;
        nqPointTable.appendChild(nqRow);
    }
}

window.calculateTrade = calculateTrade;
window.calculateFutures = calculateFutures;