#include "mainwindow.h"
#include <QCoreApplication>
#include <QVBoxLayout>
#include <QWidget>
#include <QHeaderView>
#include <QDateTime>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    auto *central = new QWidget(this);
    auto *layout = new QVBoxLayout(central);

    table = new QTableWidget(0, 6, this);
    table->setHorizontalHeaderLabels({"Device", "Action", "State", "Pressure", "Flow", "Value"});
    table->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);

    log = new QTextEdit(this);
    log->setReadOnly(true);

    layout->addWidget(table);
    layout->addWidget(log);
    setCentralWidget(central);
    setWindowTitle("VoltGuard Dashboard");

    loadLog();
}

void MainWindow::loadLog() {
    // Resolve decisions.jsonl relative to the executable's directory so the
    // dashboard works regardless of the current working directory.
    QString decisionPath = QCoreApplication::applicationDirPath() + "/../output/decisions.jsonl";
    QFile file(decisionPath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        log->setPlainText("No output/decisions.jsonl found yet. Run interceptor.py first.");
        return;
    }

    while (!file.atEnd()) {
        QByteArray line = file.readLine().trimmed();
        if (line.isEmpty()) continue;

        QJsonDocument doc = QJsonDocument::fromJson(line);
        if (!doc.isObject()) continue;

        QJsonObject obj = doc.object();
        int row = table->rowCount();
        table->insertRow(row);

        table->setItem(row, 0, new QTableWidgetItem(QString::number(obj["device_id"].toInt())));
        table->setItem(row, 1, new QTableWidgetItem(obj["action"].toString()));
        table->setItem(row, 2, new QTableWidgetItem(obj["state"].toString()));
        table->setItem(row, 3, new QTableWidgetItem(QString::number(obj["pressure_bar"].toDouble(), 'f', 2)));
        table->setItem(row, 4, new QTableWidgetItem(QString::number(obj["flow_rate"].toDouble(), 'f', 2)));
        table->setItem(row, 5, new QTableWidgetItem(QString::number(obj["value"].toDouble(), 'f', 2)));

        log->append(line);
    }
}