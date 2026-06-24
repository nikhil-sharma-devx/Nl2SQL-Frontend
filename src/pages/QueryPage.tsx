/**
 * QueryPage — main chat interface page.
 * Thin composition layer over the useChat hook + extracted components.
 * (Logic/data-flow unchanged; restyled.)
 */
import { useState, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { useSettings } from '../hooks/useSettings';
import { handleApiError, submitFeedback } from '../api/client';
import ChatWindow from '../components/ChatWindow';
import QueryInput from '../components/QueryInput';
import SchemaGraph from '../components/SchemaGraph';
import QueryBuilder from '../components/QueryBuilder';
import { cn } from '@/lib/utils';

const QueryPage = () => {
  const {
    messages,
    question,
    setQuestion,
    pendingQuestion,
    loadingText,
    thinkingSteps,
    isLoading,
    isError,
    error,
    validationError,
    rateLimitError,
    sendMessage,
    abortQuery,
    addDirectSqlMessage,
    handleRetry,
    clearValidationError,
    messagesEndRef,
  } = useChat();

  const { settings, isLoading: settingsLoading } = useSettings();
  const [editedResults, setEditedResults] = useState<Record<number, any>>({});
  const [execute, setExecute] = useState(false);
  const [dialect, setDialect] = useState('postgresql');

  // Sync execute/dialect whenever settings load or are saved
  useEffect(() => {
    if (!settingsLoading) {
      setExecute(settings.auto_execute);
      setDialect(settings.default_dialect || 'postgresql');
    }
  }, [settingsLoading, settings.auto_execute, settings.default_dialect]);

  const [showGraph, setShowGraph] = useState(false);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);

  const handleSuggestionClick = async (suggestion: string) => {
    setQuestion(suggestion);
    setTimeout(() => {
      sendMessage(dialect, true);
    }, 100);
  };

  const handleSqlExecuted = (_messageId: number, _sql: string, execResult?: any) => {
    if (execResult) {
      setEditedResults((prev) => ({ ...prev, [_messageId]: execResult }));
    }
  };

  const handleFeedback = async (feedback: any) => {
    try {
      await submitFeedback(feedback);
    } catch {
      // feedback is best-effort — don't surface errors to the user
    }
  };

  const highlightedTables = messages.flatMap((m) =>
    m.response ? m.response.used_tables || m.response.retrieved_tables || [] : [],
  );

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[1fr_auto] gap-4 overflow-hidden">
      {/* Messages Area & Optional Graph & Query Builder */}
      <div className="relative min-h-0 h-full w-full overflow-hidden">
        <div className={cn('absolute inset-0 flex gap-4', (showGraph || showQueryBuilder) ? 'flex-row' : 'flex-col')}>
          <div className={cn('flex h-full flex-col transition-all duration-300', (showGraph || showQueryBuilder) ? 'w-1/2' : 'w-full')}>
            <ChatWindow
              messages={messages}
              pendingQuestion={pendingQuestion}
              loadingText={loadingText}
              thinkingSteps={thinkingSteps}
              isLoading={isLoading}
              isError={isError}
              error={error}
              execute={execute}
              rateLimitError={rateLimitError}
              onRetry={() => handleRetry(dialect)}
              handleApiError={handleApiError}
              messagesEndRef={messagesEndRef}
              onSuggestionClick={handleSuggestionClick}
              onSqlExecuted={handleSqlExecuted}
              editedResults={editedResults}
              onFeedback={handleFeedback}
            />
          </div>

          {showGraph && (
            <div className="flex h-full w-1/2 flex-col transition-all duration-300 animate-slide-up">
              <SchemaGraph highlightedTables={highlightedTables} />
            </div>
          )}

          {showQueryBuilder && (
            <div className="flex h-full w-1/2 flex-col transition-all duration-300 animate-slide-up">
              <QueryBuilder
                onClose={() => setShowQueryBuilder(false)}
                onRunViaAi={(nlPrompt) => {
                  setQuestion(nlPrompt);
                  setShowQueryBuilder(false);
                  setTimeout(() => {
                    sendMessage(dialect, true);
                  }, 100);
                }}
                onExecuteDirectSql={async (sql, nlPrompt) => {
                  setShowQueryBuilder(false);
                  await addDirectSqlMessage(sql, nlPrompt);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="z-20 shrink-0">
        <QueryInput
          question={question}
          onQuestionChange={setQuestion}
          onSubmit={sendMessage}
          onAbort={abortQuery}
          isLoading={isLoading}
          validationError={validationError}
          onClearValidationError={clearValidationError}
          execute={execute}
          onExecuteChange={setExecute}
          dialect={dialect}
          onDialectChange={setDialect}
          messageCount={messages.length}
          onToggleGraph={() => {
            setShowGraph(!showGraph);
            setShowQueryBuilder(false);
          }}
          showGraph={showGraph}
          onToggleQueryBuilder={() => {
            setShowQueryBuilder(!showQueryBuilder);
            setShowGraph(false);
          }}
        />
      </div>
    </div>
  );
};

export default QueryPage;
