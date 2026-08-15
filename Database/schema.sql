-- Fallback script if you prefer to create the schema by hand instead of
-- running EF Core migrations (Add-Migration / Update-Database).
-- Safe to run more than once.

IF DB_ID('TeamTaskTrackerDb') IS NULL
BEGIN
    CREATE DATABASE TeamTaskTrackerDb;
END
GO

USE TeamTaskTrackerDb;
GO

IF OBJECT_ID('dbo.Tasks', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tasks (
        Id            UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        Title         NVARCHAR(200)    NOT NULL,
        Description   NVARCHAR(1000)   NULL,
        Priority      NVARCHAR(20)     NOT NULL CONSTRAINT DF_Tasks_Priority DEFAULT 'Medium',
        Status        NVARCHAR(20)     NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT 'Pending',
        CreatedAt     DATETIME2        NOT NULL CONSTRAINT DF_Tasks_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt     DATETIME2        NULL,

        CONSTRAINT CK_Tasks_Priority CHECK (Priority IN ('Low', 'Medium', 'High')),
        CONSTRAINT CK_Tasks_Status   CHECK (Status IN ('Pending', 'Completed'))
    );

    CREATE INDEX IX_Tasks_Status ON dbo.Tasks(Status);
END
GO
