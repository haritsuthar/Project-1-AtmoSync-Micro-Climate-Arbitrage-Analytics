#pragma once
#include <QMainWindow>
#include <QTableWidget>
#include <QTextEdit>

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    MainWindow(QWidget *parent = nullptr);

private:
    QTableWidget *table;
    QTextEdit *log;
    void loadLog();
};