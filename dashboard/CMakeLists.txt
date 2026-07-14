cmake_minimum_required(VERSION 3.16)
project(VoltGuardDashboard LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Widgets)

add_executable(VoltGuardDashboard
    main.cpp
    mainwindow.h
    mainwindow.cpp
)

target_link_libraries(VoltGuardDashboard PRIVATE Qt6::Widgets)